import time
from typing import Iterable

from web3 import Web3
from web3.providers import WebSocketProvider
from web3.providers.rpc import HTTPProvider

from .abi import MORPHO_ABI
from .config import get_chain, get_rpc_url, get_telegram_config
from .digest import TxDeduper, digest_tx
from .telegram_bot import TelegramBot


LIQUIDATE_EVENT_SIG = "Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)"


def monitor_market(chain_id: int, market_id: str | None, poll_interval: float = 2.0) -> None:
    w3 = _build_web3(chain_id)
    chain = get_chain(chain_id)
    bot = TelegramBot(*get_telegram_config())

    morpho_address = Web3.to_checksum_address(chain.morpho_address)
    morpho = w3.eth.contract(address=morpho_address, abi=MORPHO_ABI)

    topics = [Web3.keccak(text=LIQUIDATE_EVENT_SIG).hex()]
    if market_id:
        topics.append(_normalize_market_id(market_id))

    log_filter = w3.eth.filter({"address": morpho_address, "topics": topics})
    deduper = TxDeduper()

    print(f"Monitoring {chain.name} market={market_id or 'ALL'}")
    while True:
        for log in _poll_filter(log_filter):
            tx_hash = log["transactionHash"].hex()
            if deduper.seen(tx_hash):
                continue
            deduper.add(tx_hash)
            message = digest_tx(tx_hash, chain_id)
            bot.send_message(message)
        time.sleep(poll_interval)


def _build_web3(chain_id: int) -> Web3:
    try:
        rpc_url = get_rpc_url(chain_id, prefer_wss=True)
        return Web3(WebSocketProvider(rpc_url))
    except Exception:
        rpc_url = get_rpc_url(chain_id, prefer_wss=False)
        return Web3(HTTPProvider(rpc_url))


def _poll_filter(log_filter) -> Iterable[dict]:
    try:
        return log_filter.get_new_entries()
    except ValueError:
        return []


def _normalize_market_id(market_id: str) -> str:
    market_id = market_id.lower()
    if not market_id.startswith("0x"):
        market_id = "0x" + market_id
    return market_id
