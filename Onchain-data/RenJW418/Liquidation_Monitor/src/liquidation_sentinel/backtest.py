from __future__ import annotations

from typing import Iterable

from web3 import Web3
from web3.providers.rpc import HTTPProvider

from .config import get_chain, get_rpc_url, get_telegram_config
from .digest import digest_tx
from .telegram_bot import TelegramBot
from .monitor import LIQUIDATE_EVENT_SIG


def backtest(chain_id: int, from_block: int, to_block: int, market_id: str | None) -> None:
    rpc_url = get_rpc_url(chain_id, prefer_wss=False)
    w3 = Web3(HTTPProvider(rpc_url))
    chain = get_chain(chain_id)
    bot = TelegramBot(*get_telegram_config())

    morpho_address = Web3.to_checksum_address(chain.morpho_address)
    event_sig = Web3.keccak(text=LIQUIDATE_EVENT_SIG).hex()
    topics = [event_sig]
    if market_id:
        topics.append(_normalize_market_id(market_id))

    logs = _get_logs_chunked(w3, morpho_address, topics, from_block, to_block, chunk=1000)
    sorted_logs = sorted(logs, key=lambda x: (x["blockNumber"], x["transactionIndex"], x["logIndex"]))

    tx_hashes = []
    seen = set()
    for log in sorted_logs:
        tx_hash = log["transactionHash"].hex()
        if tx_hash in seen:
            continue
        seen.add(tx_hash)
        tx_hashes.append(tx_hash)

    for tx_hash in tx_hashes:
        message = digest_tx(tx_hash, chain_id)
        bot.send_message(message)


def _get_logs_chunked(
    w3: Web3,
    morpho_address: str,
    topics: list[str],
    start_block: int,
    end_block: int,
    chunk: int,
) -> Iterable[dict]:
    logs = []
    current = start_block
    while current <= end_block:
        to_block = min(current + chunk - 1, end_block)
        entries = w3.eth.get_logs(
            {
                "fromBlock": current,
                "toBlock": to_block,
                "address": morpho_address,
                "topics": topics,
            }
        )
        logs.extend(entries)
        current = to_block + 1
    return logs


def _normalize_market_id(market_id: str) -> str:
    market_id = market_id.lower()
    if not market_id.startswith("0x"):
        market_id = "0x" + market_id
    return market_id
