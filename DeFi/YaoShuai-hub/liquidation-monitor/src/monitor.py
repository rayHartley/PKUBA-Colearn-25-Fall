"""Real-time liquidation event monitor using WebSocket subscription."""

import asyncio
import json
import logging
import signal
import sys

from web3 import Web3

from .config import HYPER_RPC_HTTP, HYPER_RPC_WSS, MARKET_ID, MORPHO_ADDRESS
from .digest import digest_tx
from .telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)


# Liquidate event signature topic
# keccak256("Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)")
def get_liquidate_topic() -> str:
    """Compute the Liquidate event topic hash."""
    sig = "Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)"
    return Web3.keccak(text=sig).hex()


async def monitor_liquidations(
    rpc_http: str | None = None,
    rpc_wss: str | None = None,
    market_id: str | None = None,
):
    """Subscribe to Morpho Liquidate events and send digests to Telegram.

    Uses WebSocket subscription for real-time event monitoring.
    Falls back to polling if WSS is not available.
    """
    http_url = rpc_http or HYPER_RPC_HTTP
    wss_url = rpc_wss or HYPER_RPC_WSS
    target_market = market_id or MARKET_ID

    notifier = TelegramNotifier()
    w3_http = Web3(Web3.HTTPProvider(http_url))

    liquidate_topic = get_liquidate_topic()
    market_id_topic = target_market  # indexed parameter

    logger.info(f"Starting liquidation monitor...")
    logger.info(f"Morpho contract: {MORPHO_ADDRESS}")
    logger.info(f"Market ID: {target_market}")
    logger.info(f"Liquidate topic: {liquidate_topic}")

    # Send startup message
    await notifier.send_message(
        f"🟢 Liquidation Monitor Started\n"
        f"Contract: {MORPHO_ADDRESS}\n"
        f"Market: {target_market[:16]}..."
    )

    try:
        # Try WebSocket subscription first
        await _subscribe_wss(wss_url, http_url, liquidate_topic, market_id_topic, notifier)
    except Exception as e:
        logger.warning(f"WSS subscription failed: {e}, falling back to polling")
        await _poll_events(w3_http, liquidate_topic, market_id_topic, notifier)


async def _subscribe_wss(
    wss_url: str,
    http_url: str,
    liquidate_topic: str,
    market_id_topic: str,
    notifier: TelegramNotifier,
):
    """Subscribe to events via WebSocket."""
    import websockets

    filter_params = {
        "address": MORPHO_ADDRESS,
        "topics": [liquidate_topic, market_id_topic],
    }

    async with websockets.connect(wss_url) as ws:
        # Subscribe to logs
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
        logger.info(f"Subscribed with ID: {subscription_id}")

        # Listen for events
        while True:
            try:
                msg = await ws.recv()
                data = json.loads(msg)

                if "params" in data and data.get("method") == "eth_subscription":
                    log = data["params"]["result"]
                    tx_hash = log["transactionHash"]
                    logger.info(f"Liquidation detected! Tx: {tx_hash}")

                    # Generate digest
                    try:
                        digest_msg = digest_tx(tx_hash, rpc_url=http_url)
                        await notifier.send_message(digest_msg)
                    except Exception as e:
                        logger.error(f"Error processing tx {tx_hash}: {e}")
                        await notifier.send_message(
                            f"⚠️ Error processing liquidation tx: {tx_hash}\n{str(e)[:200]}"
                        )

            except websockets.ConnectionClosed:
                logger.warning("WebSocket connection closed, reconnecting...")
                raise


async def _poll_events(
    w3: Web3,
    liquidate_topic: str,
    market_id_topic: str,
    notifier: TelegramNotifier,
    poll_interval: int = 5,
):
    """Fallback: poll for new events periodically."""
    last_block = w3.eth.block_number
    logger.info(f"Polling from block {last_block}, interval={poll_interval}s")

    seen_txs: set[str] = set()

    while True:
        try:
            current_block = w3.eth.block_number
            if current_block > last_block:
                logs = w3.eth.get_logs(
                    {
                        "address": Web3.to_checksum_address(MORPHO_ADDRESS),
                        "topics": [liquidate_topic, market_id_topic],
                        "fromBlock": last_block + 1,
                        "toBlock": current_block,
                    }
                )

                for log in logs:
                    tx_hash = log["transactionHash"].hex()
                    if tx_hash in seen_txs:
                        continue
                    seen_txs.add(tx_hash)

                    logger.info(f"Liquidation detected (poll)! Tx: {tx_hash}")
                    try:
                        digest_msg = digest_tx(tx_hash)
                        await notifier.send_message(digest_msg)
                    except Exception as e:
                        logger.error(f"Error processing tx {tx_hash}: {e}")

                last_block = current_block

        except Exception as e:
            logger.error(f"Polling error: {e}")

        await asyncio.sleep(poll_interval)


def main():
    """Entry point for the monitor."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    loop = asyncio.new_event_loop()

    # Graceful shutdown
    def shutdown(sig, frame):
        logger.info("Shutting down monitor...")
        loop.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    try:
        loop.run_until_complete(monitor_liquidations())
    except KeyboardInterrupt:
        logger.info("Monitor stopped by user")
    finally:
        loop.close()


if __name__ == "__main__":
    main()
