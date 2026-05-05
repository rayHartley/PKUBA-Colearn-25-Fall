"""Configuration and constants for the liquidation monitor."""

import os
from dotenv import load_dotenv

load_dotenv()

# RPC endpoints
HYPER_RPC_HTTP = os.getenv("HYPER_RPC_HTTP", "https://rpc.hyperliquid.xyz/evm")
HYPER_RPC_WSS = os.getenv("HYPER_RPC_WSS", "wss://rpc.hyperliquid.xyz/evm")

# Telegram
TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN", "")
TG_CHAT_ID = os.getenv("TG_CHAT_ID", "")

# Morpho Blue singleton contract on HyperEVM
MORPHO_ADDRESS = os.getenv(
    "MORPHO_ADDRESS", "0x68e37dE8d93d3496ae143F2E900490f6280C57cD"
)

# Target market: kHYPE / WHYPE
MARKET_ID = os.getenv(
    "MARKET_ID",
    "0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc",
)

# HyperEVM chain ID
CHAIN_ID = 999

# Token decimals
WHYPE_DECIMALS = 18  # loan token (WHYPE)
KHYPE_DECIMALS = 18  # collateral token (kHYPE)

# Morpho oracle price scale: 36 + loan_decimals - collateral_decimals
# For WHYPE(18) / kHYPE(18): scale = 36 + 18 - 18 = 36
ORACLE_PRICE_SCALE = 36

# Telegram rate limit: max messages per second
TG_RATE_LIMIT = 1.0  # 1 message per second to be safe

# Etherscan V2 API key (works for HyperEVM chain_id=999)
ETHERSCAN_API_KEY = os.getenv("ETHERSCAN_API_KEY", "")
