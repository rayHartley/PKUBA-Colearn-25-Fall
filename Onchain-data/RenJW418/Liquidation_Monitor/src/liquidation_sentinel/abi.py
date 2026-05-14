MORPHO_ABI = [
    {
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
    },
    {
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
    },
]

ORACLE_ABI = [
    {
        "inputs": [],
        "name": "price",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    }
]

ERC20_ABI = [
    {
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "stateMutability": "view",
        "type": "function",
    },
]
