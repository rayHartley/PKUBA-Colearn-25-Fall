"""Oracle price querying for Morpho Blue markets."""

from web3 import Web3

from .abi import MORPHO_ABI, ORACLE_ABI


def get_market_params(
    w3: Web3, market_id: str, block: int | str = "latest", morpho_address: str | None = None
) -> dict:
    """Query market parameters from Morpho Blue contract.

    Returns dict with keys: loanToken, collateralToken, oracle, irm, lltv
    """
    from .config import MORPHO_ADDRESS as DEFAULT_MORPHO
    addr = morpho_address or DEFAULT_MORPHO
    morpho = w3.eth.contract(
        address=Web3.to_checksum_address(addr), abi=MORPHO_ABI
    )
    result = morpho.functions.idToMarketParams(bytes.fromhex(market_id[2:])).call(
        block_identifier=block
    )
    return {
        "loanToken": result[0],
        "collateralToken": result[1],
        "oracle": result[2],
        "irm": result[3],
        "lltv": result[4],
    }


def get_oracle_price(w3: Web3, oracle_address: str, block: int | str = "latest") -> int:
    """Query the oracle price at a specific block.

    The Morpho oracle returns a price scaled by 10^ORACLE_PRICE_SCALE.
    price = collateralToken_price / loanToken_price * 10^(36 + loan_decimals - collateral_decimals)

    For kHYPE/WHYPE (both 18 decimals):
        price = kHYPE_price_in_loan / 1 * 10^36

    So to get the collateral value in loan token terms:
        value_in_loan = seizedAssets * price / 10^36
    """
    oracle = w3.eth.contract(
        address=Web3.to_checksum_address(oracle_address), abi=ORACLE_ABI
    )
    price = oracle.functions.price().call(block_identifier=block)
    return price


def compute_gross_revenue(
    repaid_assets: int,
    seized_assets: int,
    oracle_price: int,
    loan_decimals: int = 18,
    collateral_decimals: int = 18,
) -> dict:
    """Compute gross revenue from a liquidation.

    Morpho Blue oracle price definition:
        price() returns a value such that:
            collateral_value_in_loan_raw = seized_assets * oracle_price / 10^36

    The oracle contract internally handles decimal normalization between
    collateral and loan tokens. The division is always by the constant
    ORACLE_PRICE_SCALE = 10^36.

    Gross revenue = collateral_value_in_loan - repaid_assets (in loan token raw units)

    Returns dict with:
        - collateral_value_in_loan: value of seized collateral in loan token (raw int)
        - repaid_in_loan: repaid amount in loan token (raw int)
        - gross_revenue_raw: raw gross revenue in loan token units (int)
        - gross_revenue: gross revenue in human-readable form (float, in loan token)
    """
    # Morpho Blue always uses 10^36 as the oracle price scale
    # The oracle price already encodes the decimal relationship internally
    scale = 10**36

    # Value of seized collateral expressed in loan token raw units
    collateral_value_in_loan = seized_assets * oracle_price // scale

    # Gross revenue in raw loan token units
    gross_revenue_raw = collateral_value_in_loan - repaid_assets

    # Human-readable values
    gross_revenue_human = gross_revenue_raw / (10**loan_decimals)
    collateral_value_human = collateral_value_in_loan / (10**loan_decimals)
    repaid_human = repaid_assets / (10**loan_decimals)

    return {
        "collateral_value_in_loan": collateral_value_in_loan,
        "repaid_in_loan": repaid_assets,
        "gross_revenue_raw": gross_revenue_raw,
        "gross_revenue": gross_revenue_human,
        "collateral_value": collateral_value_human,
        "repaid": repaid_human,
        "seized_assets_raw": seized_assets,
    }
