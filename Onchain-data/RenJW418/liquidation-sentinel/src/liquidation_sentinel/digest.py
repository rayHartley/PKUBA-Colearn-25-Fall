from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from decimal import Decimal, getcontext
from typing import Any

from web3 import Web3
from web3.exceptions import ContractLogicError
from web3.providers.rpc import HTTPProvider

from .abi import ERC20_ABI, MORPHO_ABI
from .config import ORACLE_PRICE_SCALE, get_chain, get_rpc_url
from .oracle import get_oracle_price

LIQUIDATE_EVENT_SIG = "Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)"

getcontext().prec = 50


@dataclass(frozen=True)
class TokenInfo:
    address: str
    decimals: int
    symbol: str


def digest_tx(tx_hash: str, chain_id: int) -> str:
    rpc_url = get_rpc_url(chain_id, prefer_wss=False)
    w3 = Web3(HTTPProvider(rpc_url))
    chain = get_chain(chain_id)
    morpho = w3.eth.contract(address=Web3.to_checksum_address(chain.morpho_address), abi=MORPHO_ABI)

    tx = w3.eth.get_transaction(tx_hash)
    receipt = w3.eth.get_transaction_receipt(tx_hash)
    block = w3.eth.get_block(receipt.blockNumber)

    liquidations = []
    event_sig = Web3.keccak(text=LIQUIDATE_EVENT_SIG).hex()
    for log in receipt.logs:
        if log["address"].lower() != chain.morpho_address.lower():
            continue
        if not log["topics"] or log["topics"][0].hex() != event_sig:
            continue
        try:
            parsed = morpho.events.Liquidate().process_log(log)
        except (ContractLogicError, ValueError):
            continue
        liquidations.append(parsed)

    if not liquidations:
        return f"No Morpho liquidation events found for tx {tx_hash}."

    token_cache: dict[str, TokenInfo] = {}
    lines = []
    for event in liquidations:
        event_args = event["args"]
        market_id = event_args["id"].hex()
        market_params = morpho.functions.idToMarketParams(event_args["id"]).call()
        loan_token = Web3.to_checksum_address(market_params[0])
        collateral_token = Web3.to_checksum_address(market_params[1])
        oracle_address = Web3.to_checksum_address(market_params[2])

        loan_info = _get_token_info(w3, loan_token, token_cache)
        collateral_info = _get_token_info(w3, collateral_token, token_cache)

        price = get_oracle_price(w3, oracle_address, receipt.blockNumber)
        repaid_assets = int(event_args["repaidAssets"])
        seized_assets = int(event_args["seizedAssets"])

        gross = _gross_revenue(repaid_assets, seized_assets, price)
        gas_cost, bribe_cost = _gas_and_bribe_costs(block, receipt)
        net_profit = gross - gas_cost - bribe_cost
        margin = _margin(net_profit, gross)

        lines.extend(
            [
                f"Chain: {chain.name} ({chain.chain_id})",
                f"Tx: {tx_hash}",
                f"Block: {receipt.blockNumber}",
                f"Market: {market_id}",
                f"Borrower: {event_args['borrower']}",
                f"Liquidator: {event_args['caller']}",
                f"Repaid: {_format_units(repaid_assets, loan_info.decimals)} {loan_info.symbol}",
                f"Seized: {_format_units(seized_assets, collateral_info.decimals)} {collateral_info.symbol}",
                f"Oracle price: {_format_price(price)} {loan_info.symbol}/{collateral_info.symbol}",
                f"Gross revenue: {_format_units_decimal(gross, loan_info.decimals)} {loan_info.symbol}",
                f"Gas cost: {_format_units_decimal(gas_cost, 18)} HYPE",
                f"Bribe cost: {_format_units_decimal(bribe_cost, 18)} HYPE",
                f"Net profit: {_format_units_decimal(net_profit, loan_info.decimals)} {loan_info.symbol}",
                f"Margin: {margin}",
                "---",
            ]
        )

    return "\n".join(lines).rstrip("-\n")


def _get_token_info(w3: Web3, token_address: str, cache: dict[str, TokenInfo]) -> TokenInfo:
    if token_address in cache:
        return cache[token_address]

    token = w3.eth.contract(address=token_address, abi=ERC20_ABI)
    try:
        decimals = int(token.functions.decimals().call())
    except Exception:
        decimals = 18

    try:
        symbol = token.functions.symbol().call()
        if isinstance(symbol, (bytes, bytearray)):
            symbol = symbol.decode(errors="ignore").strip("\x00")
        if not symbol:
            symbol = _short_address(token_address)
    except Exception:
        symbol = _short_address(token_address)

    info = TokenInfo(address=token_address, decimals=decimals, symbol=symbol)
    cache[token_address] = info
    return info


def _short_address(address: str) -> str:
    return f"{address[:6]}...{address[-4:]}"


def _gross_revenue(repaid_assets: int, seized_assets: int, oracle_price: int) -> Decimal:
    price = Decimal(oracle_price)
    seized_value = Decimal(seized_assets) * price / Decimal(ORACLE_PRICE_SCALE)
    return seized_value - Decimal(repaid_assets)


def _gas_and_bribe_costs(block: Any, receipt: Any) -> tuple[Decimal, Decimal]:
    gas_used = int(receipt["gasUsed"])
    effective_gas_price = int(receipt.get("effectiveGasPrice", 0))
    base_fee = int(block.get("baseFeePerGas", 0))

    priority_fee = max(effective_gas_price - base_fee, 0)
    gas_cost = Decimal(base_fee) * Decimal(gas_used)
    bribe_cost = Decimal(priority_fee) * Decimal(gas_used)
    return gas_cost, bribe_cost


def _margin(net_profit: Decimal, gross: Decimal) -> str:
    if gross == 0:
        return "0.00%"
    pct = (net_profit / gross) * Decimal(100)
    return f"{pct:.2f}%"


def _format_units(value: int, decimals: int, precision: int = 6) -> str:
    return _format_decimal(Decimal(value), decimals, precision)


def _format_units_decimal(value: Decimal, decimals: int, precision: int = 6) -> str:
    return _format_decimal(value, decimals, precision)


def _format_decimal(value: Decimal, decimals: int, precision: int) -> str:
    scale = Decimal(10) ** Decimal(decimals)
    num = value / scale
    fmt = f"{{0:.{precision}f}}"
    out = fmt.format(num)
    return out.rstrip("0").rstrip(".")


def _format_price(price: int) -> str:
    num = Decimal(price) / Decimal(ORACLE_PRICE_SCALE)
    return f"{num:.6f}".rstrip("0").rstrip(".")


class TxDeduper:
    def __init__(self, max_items: int = 1024) -> None:
        self._deque = deque(maxlen=max_items)
        self._set: set[str] = set()

    def add(self, tx_hash: str) -> None:
        if tx_hash in self._set:
            return
        if len(self._deque) == self._deque.maxlen:
            oldest = self._deque.popleft()
            self._set.discard(oldest)
        self._deque.append(tx_hash)
        self._set.add(tx_hash)

    def seen(self, tx_hash: str) -> bool:
        return tx_hash in self._set
