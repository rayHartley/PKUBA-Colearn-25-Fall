"""Multi-market monitor: watches ALL Morpho markets on a given chain.

Challenge 1: Extend from single market (kHYPE/WHYPE) to all markets on HyperEVM
Challenge 2: Multi-chain support (see chains.py for chain configs)
"""

import asyncio
import json
import logging
import signal
import sys

from web3 import Web3

from .chains import CHAIN_CONFIGS, ChainConfig, get_chain_config
from .config import HYPER_RPC_HTTP, HYPER_RPC_WSS, MORPHO_ADDRESS
from .digest import digest_tx
from .monitor import get_liquidate_topic
from .telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)


async def monitor_all_markets(
    chain_id: int = 999,
    rpc_http: str | None = None,
    rpc_wss: str | None = None,
):
    """Monitor ALL Morpho Liquidation events on a given chain (all markets).

    Instead of filtering by market_id topic, we only filter by:
    - contract address (Morpho Blue singleton)
    - event signature (Liquidate)

    This captures liquidations across ALL markets.
    """
    chain = get_chain_config(chain_id)
    http_url = rpc_http or chain.rpc_http
    wss_url = rpc_wss or chain.rpc_wss
    morpho_addr = chain.morpho_address

    notifier = TelegramNotifier()
    w3 = Web3(Web3.HTTPProvider(http_url))

    liquidate_topic = get_liquidate_topic()

    logger.info(f"Starting ALL-MARKET monitor on {chain.name} (chain_id={chain_id})")
    logger.info(f"Morpho contract: {morpho_addr}")
    logger.info(f"Liquidate topic: {liquidate_topic}")

    await notifier.send_message(
        f"🟢 Multi-Market Liquidation Monitor Started\n"
        f"Chain: {chain.name} (ID: {chain_id})\n"
        f"Contract: {morpho_addr}\n"
        f"Monitoring: ALL markets"
    )

    # No market_id filter — capture all liquidations
    try:
        await _subscribe_all_markets_wss(
            wss_url, http_url, morpho_addr, liquidate_topic, notifier
        )
    except Exception as e:
        logger.warning(f"WSS failed: {e}, falling back to polling")
        await _poll_all_markets(
            w3, morpho_addr, liquidate_topic, notifier, http_url
        )


async def _subscribe_all_markets_wss(
    wss_url: str,
    http_url: str,
    morpho_addr: str,
    liquidate_topic: str,
    notifier: TelegramNotifier,
):
    """Subscribe to ALL Liquidate events (no market filter) via WebSocket."""
    import websockets

    filter_params = {
        "address": morpho_addr,
        "topics": [liquidate_topic],  # Only filter by event signature
    }

    async with websockets.connect(wss_url) as ws:
        subscribe_msg = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_subscribe",
            "params": ["logs", filter_params],
        }
        await ws.send(json.dumps(subscribe_msg))
        response = await ws.recv()
        result = json.loads(response)

        if "error" in result:
            raise Exception(f"Subscription failed: {result['error']}")

        subscription_id = result.get("result")
        logger.info(f"Subscribed (all markets) with ID: {subscription_id}")

        seen_txs: set[str] = set()

        while True:
            try:
                msg = await ws.recv()
                data = json.loads(msg)

                if "params" in data and data.get("method") == "eth_subscription":
                    log = data["params"]["result"]
                    tx_hash = log["transactionHash"]

                    if tx_hash in seen_txs:
                        continue
                    seen_txs.add(tx_hash)

                    # Extract market_id from the event
                    market_id = log["topics"][1] if len(log["topics"]) > 1 else "unknown"
                    logger.info(
                        f"Liquidation! Market: {market_id[:16]}... Tx: {tx_hash}"
                    )

                    try:
                        digest_msg = digest_tx(tx_hash, rpc_url=http_url)
                        await notifier.send_message(digest_msg)
                    except Exception as e:
                        logger.error(f"Error processing tx {tx_hash}: {e}")
                        await notifier.send_message(
                            f"⚠️ Error processing liquidation\n"
                            f"Market: {market_id[:16]}...\n"
                            f"Tx: {tx_hash}\n"
                            f"Error: {str(e)[:200]}"
                        )

            except websockets.ConnectionClosed:
                logger.warning("WebSocket closed, reconnecting...")
                raise


async def _poll_all_markets(
    w3: Web3,
    morpho_addr: str,
    liquidate_topic: str,
    notifier: TelegramNotifier,
    http_url: str,
    poll_interval: int = 5,
):
    """Poll for ALL Liquidate events (no market filter)."""
    last_block = w3.eth.block_number
    seen_txs: set[str] = set()

    logger.info(f"Polling all markets from block {last_block}")

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block > last_block:
                logs = w3.eth.get_logs(
                    {
                        "address": Web3.to_checksum_address(morpho_addr),
                        "topics": [liquidate_topic],  # No market filter
                        "fromBlock": last_block + 1,
                        "toBlock": current_block,
                    }
                )

                for log in logs:
                    tx_hash = log["transactionHash"].hex()
                    if tx_hash in seen_txs:
                        continue
                    seen_txs.add(tx_hash)

                    logger.info(f"Liquidation (poll)! Tx: {tx_hash}")
                    try:
                        digest_msg = digest_tx(tx_hash, rpc_url=http_url)
                        await notifier.send_message(digest_msg)
                    except Exception as e:
                        logger.error(f"Error: {e}")

                last_block = current_block

        except Exception as e:
            logger.error(f"Polling error: {e}")

        await asyncio.sleep(poll_interval)


async def monitor_multi_chain(chain_ids: list[int] | None = None):
    """Monitor Morpho liquidations across multiple chains simultaneously.

    Challenge 2: Launches parallel monitors for each configured chain.
    """
    chains = chain_ids or list(CHAIN_CONFIGS.keys())

    logger.info(f"Starting multi-chain monitor for chains: {chains}")

    tasks = []
    for chain_id in chains:
        chain = get_chain_config(chain_id)
        logger.info(f"  - {chain.name} (chain_id={chain_id})")
        tasks.append(
            asyncio.create_task(
                monitor_all_markets(chain_id=chain_id),
                name=f"monitor-{chain.name}",
            )
        )

    # Run all chain monitors concurrently
    await asyncio.gather(*tasks, return_exceptions=True)


def main():
    """Entry point for multi-market/multi-chain monitor."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Morpho Liquidation Monitor - All Markets / Multi-Chain"
    )
    parser.add_argument(
        "--chain",
        type=int,
        default=None,
        help="Chain ID to monitor (default: all configured chains)",
    )
    parser.add_argument(
        "--all-chains",
        action="store_true",
        help="Monitor all configured chains simultaneously",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    loop = asyncio.new_event_loop()

    def shutdown(sig, frame):
        logger.info("Shutting down multi-market monitor...")
        loop.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        if args.all_chains:
            loop.run_until_complete(monitor_multi_chain())
        elif args.chain:
            loop.run_until_complete(monitor_all_markets(chain_id=args.chain))
        else:
            # Default: all markets on HyperEVM
            loop.run_until_complete(monitor_all_markets(chain_id=999))
    except KeyboardInterrupt:
        logger.info("Monitor stopped by user")
    finally:
        loop.close()


if __name__ == "__main__":
    main()
