"""ABI definitions for Morpho Blue and Oracle contracts."""

# Morpho Blue - Liquidate event
LIQUIDATE_EVENT_ABI = {
    "anonymous": False,
    "inputs": [
        {"indexed": True, "name": "id", "type": "bytes32"},
        {"indexed": True, "name": "caller", "type": "address"},
        {"indexed": True, "name": "borrower", "type": "address"},
        {"indexed": False, "name": "repaidAssets", "type": "uint256"},
        {"indexed": False, "name": "repaidShares", "type": "uint256"},
        {"indexed": False, "name": "seizedAssets", "type": "uint256"},
        {"indexed": False, "name": "badDebtAssets", "type": "uint256"},
        {"indexed": False, "name": "badDebtShares", "type": "uint256"},
    ],
    "name": "Liquidate",
    "type": "event",
}

# Morpho Blue - idToMarketParams function
ID_TO_MARKET_PARAMS_ABI = {
    "inputs": [{"name": "id", "type": "bytes32"}],
    "name": "idToMarketParams",
    "outputs": [
        {"name": "loanToken", "type": "address"},
        {"name": "collateralToken", "type": "address"},
        {"name": "oracle", "type": "address"},
        {"name": "irm", "type": "address"},
        {"name": "lltv", "type": "uint256"},
    ],
    "stateMutability": "view",
    "type": "function",
}

# Morpho Oracle - price function
ORACLE_PRICE_ABI = {
    "inputs": [],
    "name": "price",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function",
}

# Minimal ERC20 ABI for decimals
ERC20_DECIMALS_ABI = {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function",
}

# Full contract ABIs (list form for web3)
MORPHO_ABI = [
    ID_TO_MARKET_PARAMS_ABI,
    LIQUIDATE_EVENT_ABI,
]

ORACLE_ABI = [
    ORACLE_PRICE_ABI,
]

ERC20_ABI = [
    ERC20_DECIMALS_ABI,
]

# Liquidate event topic (keccak256 of event signature)
# keccak256("Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)")
LIQUIDATE_EVENT_TOPIC = (
    "0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41"
)
