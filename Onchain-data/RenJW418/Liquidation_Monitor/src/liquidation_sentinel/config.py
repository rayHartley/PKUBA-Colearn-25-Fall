import os
from dotenv import load_dotenv
from .chains import CHAINS, ChainConfig

load_dotenv()

ORACLE_PRICE_SCALE = 10**36
DEFAULT_CHAIN_ID = 999


def get_chain(chain_id: int) -> ChainConfig:
    if chain_id not in CHAINS:
        raise ValueError(f"Unsupported chain_id: {chain_id}")
    return CHAINS[chain_id]


def get_rpc_url(chain_id: int, prefer_wss: bool) -> str:
    chain = get_chain(chain_id)
    env_key = chain.rpc_wss_env if prefer_wss else chain.rpc_http_env
    rpc_url = os.getenv(env_key, "").strip()
    if not rpc_url:
        raise ValueError(f"Missing RPC url in env var: {env_key}")
    return rpc_url


def get_telegram_config() -> tuple[str, str]:
    token = os.getenv("TG_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TG_CHAT_ID", "").strip()
    return token, chat_id
