"""Digest function: analyze a liquidation tx and produce a human-readable summary."""

import time
from datetime import datetime, timezone

from web3 import Web3

from .abi import LIQUIDATE_EVENT_ABI, MORPHO_ABI
from .chains import CHAIN_CONFIGS, ChainConfig, get_chain_config
from .config import (
    CHAIN_ID,
    HYPER_RPC_HTTP,
    KHYPE_DECIMALS,
    MARKET_ID,
    MORPHO_ADDRESS,
    WHYPE_DECIMALS,
)
from .oracle import compute_gross_revenue, get_market_params, get_oracle_price

# Retry config for RPC rate limiting
MAX_RETRIES = 3
RETRY_DELAY = 5  # seconds


def _call_with_retry(fn, *args, **kwargs):
    """Call a function with automatic retry on rate limit errors."""
    for attempt in range(MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            err_str = str(e).lower()
            if "rate limit" in err_str or "429" in err_str or "-32005" in str(e):
                if attempt < MAX_RETRIES - 1:
                    wait = RETRY_DELAY * (attempt + 1)
                    time.sleep(wait)
                    continue
            raise


def parse_liquidation_events_from_receipt(
    w3: Web3, tx_hash: str, morpho_address: str | None = None
) -> list[dict]:
    """Parse Liquidate events from a transaction receipt."""
    morpho_addr = morpho_address or MORPHO_ADDRESS
    receipt = w3.eth.get_transaction_receipt(tx_hash)
    morpho = w3.eth.contract(
        address=Web3.to_checksum_address(morpho_addr), abi=MORPHO_ABI
    )

    events = []
    for log in receipt.logs:
        if log.address.lower() != morpho_addr.lower():
            continue
        try:
            event = morpho.events.Liquidate().process_log(log)
            events.append(event)
        except Exception:
            continue

    return events


def compute_tx_costs(w3: Web3, tx_hash: str) -> dict:
    """Compute gas cost and bribe (priority fee) for a transaction.

    On HyperEVM, bribe is typically expressed as priority fee.
    Returns costs in native token (HYPE) units.
    """
    tx = w3.eth.get_transaction(tx_hash)
    receipt = w3.eth.get_transaction_receipt(tx_hash)

    gas_used = receipt.gasUsed
    effective_gas_price = receipt.effectiveGasPrice

    # Total tx fee in wei
    total_fee_wei = gas_used * effective_gas_price

    # Try to get base fee from block to separate gas cost vs priority fee (bribe)
    block = w3.eth.get_block(receipt.blockNumber)
    base_fee = getattr(block, "baseFeePerGas", 0) or 0

    # Priority fee per gas = effective_gas_price - base_fee
    priority_fee_per_gas = max(0, effective_gas_price - base_fee)
    bribe_wei = gas_used * priority_fee_per_gas
    base_gas_cost_wei = gas_used * base_fee

    return {
        "gas_used": gas_used,
        "effective_gas_price": effective_gas_price,
        "base_fee": base_fee,
        "priority_fee_per_gas": priority_fee_per_gas,
        "total_fee_wei": total_fee_wei,
        "total_fee_hype": total_fee_wei / 1e18,
        "bribe_wei": bribe_wei,
        "bribe_hype": bribe_wei / 1e18,
        "base_gas_cost_wei": base_gas_cost_wei,
        "base_gas_cost_hype": base_gas_cost_wei / 1e18,
    }


def digest_tx(
    tx_hash: str,
    rpc_url: str | None = None,
    chain_id: int = 999,
    morpho_address: str | None = None,
) -> str:
    """Analyze a liquidation transaction and return a formatted digest string.

    Args:
        tx_hash: The transaction hash to analyze
        rpc_url: Optional RPC URL override
        chain_id: Chain ID (default: 999 for HyperEVM)
        morpho_address: Optional Morpho contract address override

    Returns:
        A formatted string suitable for Telegram messages
    """
    # Resolve chain config
    if chain_id in CHAIN_CONFIGS:
        chain = get_chain_config(chain_id)
        _rpc = rpc_url or chain.rpc_http
        _morpho = morpho_address or chain.morpho_address
        _native = chain.native_token
    else:
        _rpc = rpc_url or HYPER_RPC_HTTP
        _morpho = morpho_address or MORPHO_ADDRESS
        _native = "HYPE"

    w3 = Web3(Web3.HTTPProvider(_rpc))

    # Parse liquidation events (with retry)
    events = _call_with_retry(parse_liquidation_events_from_receipt, w3, tx_hash, _morpho)
    if not events:
        return f"No Liquidate events found in tx {tx_hash}"

    receipt = _call_with_retry(w3.eth.get_transaction_receipt, tx_hash)
    block_number = receipt.blockNumber

    # Get block timestamp for time display (Beijing time UTC+8)
    block_data = _call_with_retry(w3.eth.get_block, block_number)
    block_timestamp = block_data.timestamp
    from zoneinfo import ZoneInfo
    tx_time = datetime.fromtimestamp(block_timestamp, tz=ZoneInfo("Asia/Shanghai"))
    time_str = tx_time.strftime("%Y-%m-%d %H:%M:%S CST")

    # Compute tx costs (with retry)
    costs = _call_with_retry(compute_tx_costs, w3, tx_hash)

    messages = []
    for i, event in enumerate(events):
        args = event.args
        market_id_hex = "0x" + args["id"].hex()
        repaid_assets = args["repaidAssets"]
        seized_assets = args["seizedAssets"]
        bad_debt_assets = args["badDebtAssets"]
        caller = event.args["caller"]
        borrower = event.args["borrower"]

        # Get market params and oracle price at the block of the tx
        market_params = _call_with_retry(
            get_market_params, w3, market_id_hex, block=block_number, morpho_address=_morpho
        )
        oracle_address = market_params["oracle"]
        oracle_price = _call_with_retry(
            get_oracle_price, w3, oracle_address, block=block_number
        )

        # Query token decimals dynamically
        from .abi import ERC20_ABI
        try:
            loan_contract = w3.eth.contract(
                address=Web3.to_checksum_address(market_params["loanToken"]), abi=ERC20_ABI
            )
            loan_decimals = _call_with_retry(loan_contract.functions.decimals().call)
        except Exception:
            loan_decimals = 18

        try:
            coll_contract = w3.eth.contract(
                address=Web3.to_checksum_address(market_params["collateralToken"]), abi=ERC20_ABI
            )
            collateral_decimals = _call_with_retry(coll_contract.functions.decimals().call)
        except Exception:
            collateral_decimals = 18

        # Compute gross revenue
        revenue = compute_gross_revenue(
            repaid_assets=repaid_assets,
            seized_assets=seized_assets,
            oracle_price=oracle_price,
            loan_decimals=loan_decimals,
            collateral_decimals=collateral_decimals,
        )

        gross_revenue = revenue["gross_revenue"]

        # Net profit = gross revenue - total tx fee
        # Note: gross revenue is in loan token, fees are in native token
        # For simplicity, assume loan token ≈ native token (valid for WHYPE/HYPE)
        net_profit = gross_revenue - costs["total_fee_hype"]
        margin = (net_profit / gross_revenue * 100) if gross_revenue > 0 else 0

        # Format message
        msg_lines = [
            f"{'='*40}",
            f"🔴 Morpho Liquidation",
            f"{'='*40}",
            f"🕐 Time: {time_str}",
            f"📋 Tx: {tx_hash[:10]}...{tx_hash[-6:]}",
            f"🔗 Block: {block_number}",
            f"🏦 Market: {market_id_hex[:10]}...{market_id_hex[-6:]}",
            f"🌐 Chain: {_native}",
            f"",
            f"👤 Liquidator: {caller[:8]}...{caller[-6:]}",
            f"💀 Borrower: {borrower[:8]}...{borrower[-6:]}",
            f"",
            f"📊 Repaid (loan): {revenue['repaid']:.6f}",
            f"📊 Seized (collateral): {seized_assets / 10**collateral_decimals:.6f}",
            f"📊 Collateral Value (loan): {revenue['collateral_value']:.6f}",
            f"",
            f"💰 Gross Revenue: {gross_revenue:.6f} (loan token)",
            f"⛽ Gas Cost: {costs['base_gas_cost_hype']:.6f} {_native}",
            f"💸 Bribe (Priority Fee): {costs['bribe_hype']:.6f} {_native}",
            f"📈 Net Profit: {net_profit:.6f}",
            f"📊 Margin (net/gross): {margin:.2f}%",
        ]

        if bad_debt_assets > 0:
            msg_lines.append(f"⚠️ Bad Debt: {bad_debt_assets / 10**loan_decimals:.6f}")

        msg_lines.append(f"{'='*40}")
        messages.append("\n".join(msg_lines))

    return "\n\n".join(messages)
