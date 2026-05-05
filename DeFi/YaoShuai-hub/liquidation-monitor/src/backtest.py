"""Backtest: fetch historical liquidation events and replay through digest.

Supports multiple data sources:
1. eth_getLogs (on-chain, limited by RPC rate limits)
2. Etherscan V2 API (fast, reliable, recommended for HyperEVM)
3. Morpho Blue GraphQL API (fast, but may be unreliable)
"""

import asyncio
import json
import logging
import os
import sys
import time

import requests
from web3 import Web3

from .config import HYPER_RPC_HTTP, MARKET_ID, MORPHO_ADDRESS
from .digest import digest_tx
from .monitor import get_liquidate_topic
from .telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)

# HyperEVM public RPC limits: max 1000 blocks per getLogs, slow responses
RPC_REQUEST_TIMEOUT = 120  # seconds
RPC_RETRY_DELAY = 2  # seconds between retries
RPC_MAX_RETRIES = 3


def fetch_historical_liquidations(
    w3: Web3,
    from_block: int,
    to_block: int | str = "latest",
    market_id: str | None = None,
    chunk_size: int = 1000,
) -> list[dict]:
    """Fetch all historical Liquidate events for a market in block range.

    Uses chunked requests (max 1000 blocks) to respect RPC limits.
    Includes retry logic for timeout errors.
    Returns logs sorted by (blockNumber, transactionIndex, logIndex).
    """
    target_market = market_id or MARKET_ID
    liquidate_topic = get_liquidate_topic()

    if to_block == "latest":
        to_block = w3.eth.block_number

    # Enforce max chunk size of 1000 (HyperEVM limit)
    chunk_size = min(chunk_size, 1000)

    all_logs = []
    current = from_block

    while current <= to_block:
        end = min(current + chunk_size - 1, to_block)
        logger.info(f"Fetching logs from block {current} to {end}...")

        for attempt in range(RPC_MAX_RETRIES):
            try:
                logs = w3.eth.get_logs(
                    {
                        "address": Web3.to_checksum_address(MORPHO_ADDRESS),
                        "topics": [liquidate_topic, target_market],
                        "fromBlock": current,
                        "toBlock": end,
                    }
                )
                all_logs.extend(logs)
                if logs:
                    logger.info(f"  Found {len(logs)} events in this chunk")
                break
            except Exception as e:
                if attempt < RPC_MAX_RETRIES - 1:
                    logger.warning(
                        f"  Retry {attempt+1}/{RPC_MAX_RETRIES} for blocks "
                        f"{current}-{end}: {type(e).__name__}"
                    )
                    time.sleep(RPC_RETRY_DELAY * (attempt + 1))
                else:
                    logger.error(f"  Failed after {RPC_MAX_RETRIES} retries: {e}")
                    # Skip this chunk rather than crash the whole backtest
                    break

        current = end + 1

    # Sort by block number, tx index, log index
    all_logs.sort(
        key=lambda log: (log["blockNumber"], log["transactionIndex"], log["logIndex"])
    )

    return all_logs


def deduplicate_by_tx(logs: list[dict]) -> list[str]:
    """Deduplicate logs by transaction hash, preserving order."""
    seen = set()
    tx_hashes = []
    for log in logs:
        tx_hash = log["transactionHash"].hex()
        if tx_hash not in seen:
            seen.add(tx_hash)
            tx_hashes.append(tx_hash)
    return tx_hashes


def fetch_liquidations_from_api(
    market_id: str | None = None,
    chain_id: int = 999,
    limit: int = 20,
    api_key: str | None = None,
) -> list[str]:
    """Fetch liquidation tx hashes via Etherscan V2 API.

    Uses Etherscan V2 API with chainid parameter for HyperEVM and other chains.
    This is much faster and more reliable than eth_getLogs on HyperEVM's
    rate-limited public RPC.

    Returns tx hashes sorted by block number ascending.
    """
    from .config import ETHERSCAN_API_KEY, MORPHO_ADDRESS

    target_market = market_id or MARKET_ID
    key = api_key or ETHERSCAN_API_KEY or os.getenv("ETHERSCAN_API_KEY", "")

    if not key:
        logger.error("No Etherscan API key configured. Set ETHERSCAN_API_KEY in .env")
        return []

    liquidate_topic = "0xa4946ede45d0c6f06a0f5ce92c9ad3b4751452d2fe0e25010783bcab57a67e41"

    logger.info(f"Fetching liquidations from Etherscan V2 API (limit={limit})...")

    try:
        resp = requests.get(
            "https://api.etherscan.io/v2/api",
            params={
                "chainid": str(chain_id),
                "module": "logs",
                "action": "getLogs",
                "address": MORPHO_ADDRESS,
                "topic0": liquidate_topic,
                "topic1": target_market,
                "startblock": "0",
                "endblock": "99999999",
                "page": "1",
                "offset": str(limit),
                "apikey": key,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "1":
            logger.error(f"Etherscan API error: {data.get('message')} - {data.get('result')}")
            return []

        results = data["result"]
        # Deduplicate by tx hash, preserve order
        seen = set()
        tx_hashes = []
        for log in results:
            tx_hash = log["transactionHash"]
            if tx_hash not in seen:
                seen.add(tx_hash)
                tx_hashes.append(tx_hash)

        logger.info(f"  Found {len(tx_hashes)} unique liquidation transactions")
        return tx_hashes

    except Exception as e:
        logger.error(f"Failed to fetch from Etherscan API: {e}")
        return []


async def run_backtest(
    from_block: int = 0,
    to_block: int | str = "latest",
    rpc_url: str | None = None,
    send_telegram: bool = True,
    use_api: bool = False,
    limit: int = 20,
):
    """Run backtest: fetch historical events, generate digests, optionally send to TG.

    Args:
        from_block: Start block for eth_getLogs source
        to_block: End block for eth_getLogs source
        rpc_url: RPC URL override
        send_telegram: Whether to send results to Telegram
        use_api: If True, use Morpho GraphQL API instead of eth_getLogs (recommended)
        limit: Max number of txs to fetch from API
    """
    http_url = rpc_url or HYPER_RPC_HTTP

    if use_api:
        # Use Morpho API (fast, reliable)
        logger.info("Using Morpho Blue API as data source")
        tx_hashes = fetch_liquidations_from_api(limit=limit)
    else:
        # Use eth_getLogs (slow, rate-limited on HyperEVM public RPC)
        w3 = Web3(Web3.HTTPProvider(
            http_url, request_kwargs={"timeout": RPC_REQUEST_TIMEOUT}
        ))
        logger.info(f"Starting backtest from block {from_block} to {to_block}")
        logger.info(f"RPC: {http_url}")
        logs = fetch_historical_liquidations(w3, from_block, to_block)
        tx_hashes = deduplicate_by_tx(logs)

    logger.info(f"Total transactions to process: {len(tx_hashes)}")

    notifier = TelegramNotifier() if send_telegram else None

    if notifier:
        source = "Morpho API" if use_api else f"eth_getLogs ({from_block}→{to_block})"
        await notifier.send_message(
            f"🧪 Backtest Started\n"
            f"Source: {source}\n"
            f"Transactions: {len(tx_hashes)}"
        )

    results = []
    for i, tx_hash in enumerate(tx_hashes):
        logger.info(f"[{i+1}/{len(tx_hashes)}] Processing tx: {tx_hash}")
        try:
            digest_msg = digest_tx(tx_hash, rpc_url=http_url)
            results.append({"tx_hash": tx_hash, "status": "ok", "digest": digest_msg})

            if notifier:
                await notifier.send_message(digest_msg)

            print(digest_msg)
            print()

        except Exception as e:
            logger.error(f"Failed to process tx {tx_hash}: {e}")
            results.append({"tx_hash": tx_hash, "status": "error", "error": str(e)})

        # Rate limit between RPC calls to avoid being rate-limited
        time.sleep(3)

    # Summary
    ok_count = sum(1 for r in results if r["status"] == "ok")
    err_count = sum(1 for r in results if r["status"] == "error")
    summary = (
        f"\n{'='*40}\n"
        f"📊 Backtest Summary\n"
        f"{'='*40}\n"
        f"Total txs: {len(tx_hashes)}\n"
        f"Successful: {ok_count}\n"
        f"Failed: {err_count}\n"
        f"{'='*40}"
    )
    print(summary)

    if notifier:
        await notifier.send_message(summary)
        await notifier.close()

    return results


def main():
    """CLI entry point for backtest."""
    import argparse

    parser = argparse.ArgumentParser(description="Backtest liquidation monitor")
    parser.add_argument(
        "--from-block", type=int, default=0, help="Start block (default: 0)"
    )
    parser.add_argument(
        "--to-block",
        type=str,
        default="latest",
        help="End block (default: latest)",
    )
    parser.add_argument(
        "--rpc", type=str, default=None, help="RPC URL override"
    )
    parser.add_argument(
        "--no-telegram",
        action="store_true",
        help="Disable Telegram output (console only)",
    )
    parser.add_argument(
        "--api",
        action="store_true",
        help="Use Morpho GraphQL API instead of eth_getLogs (recommended for HyperEVM)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=20,
        help="Max transactions to fetch from API (default: 20)",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    to_block = int(args.to_block) if args.to_block != "latest" else "latest"

    asyncio.run(
        run_backtest(
            from_block=args.from_block,
            to_block=to_block,
            rpc_url=args.rpc,
            send_telegram=not args.no_telegram,
            use_api=args.api,
            limit=args.limit,
        )
    )


if __name__ == "__main__":
    main()
