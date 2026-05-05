"""Quick backtest using known liquidation tx hashes.

Since HyperEVM public RPC has very slow eth_getLogs responses,
this script directly tests the digest pipeline with known tx hashes
fetched from Morpho app or block explorer.

Usage:
    uv run python -m src.backtest_known
"""

import asyncio
import logging
import sys

from .digest import digest_tx
from .telegram_bot import TelegramNotifier

logger = logging.getLogger(__name__)

# Known liquidation transactions for kHYPE/WHYPE market on HyperEVM
# Source: Morpho Blue API (https://blue-api.morpho.org/graphql)
# Query: marketTransactions with type_in: [Liquidation], chainId_in: [999]
KNOWN_LIQUIDATION_TXS = [
    # (tx_hash, block_number)
    ("0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b", 33170974),
    ("0xa38cdc43c2d2f4923d03970f8ccc4697a813c871f5454e7b01b5bcc1d4a5fcd1", 33036527),
    ("0xf6a6548881fc3bc948225850240db2e531d929735594c704a81a3ee048342f4e", 33013587),
    ("0x8b3f245fca46a2936b9d1dfdba64341cbb5660bdb1dad6c52c05362c98d6b4d6", 22838764),
    ("0x8b821f112d17228aed43289c209ff7e0e7124d3eb8bce12a1666edb81de3255c", 20865174),
    ("0xd7a8164d321de90828c92b7907d24341f2930818f7ddd0050d0560959ae67ef9", 17447402),
    ("0xd9b6829abcb8e6da71c0d5ec6fdc068500119d424698a10d776adcff333af49f", 17447279),
    ("0x9028572ef791f36a4e5331b55835fe5e315dd45fa635ac56d48aae3e44dbee7d", 16995518),
    ("0x42a26acdd1f0397f91b283d807e5ec7a8ebdb3241585a283f9f68ffe0c0d60f9", 16355296),
    ("0xb6d8c4628ae647ad690c007e71c16ef88ba7b53ded9c44478d19f9b7c2c14ff7", 15148125),
    ("0x26aad4d11f50b680e1299eacd0e5929a8b83516b5f084b6cbbe566512d1610df", 14822144),
    ("0x1fa197558498c4d58c9a8b4a6285223993c94ce4ce129f9b159ff58777177af5", 14305256),
    ("0x50814fa7255f700ec69410cc90bbb1b211d6a3e3c041373dd5e76a6c2a2f31a0", 14254644),
    ("0x073662681075a527004b9179c665c2de5a2f2a45596368a371bc90faac38ea86", 14252580),
    ("0x53df728dfd71303585757a070bb09dd8127346c902497ba0d0a7a74088fcb6ad", 14119615),
    ("0xde4da6d47f85a36aeff65a860cb4fe1bb7a59fc50a7d870ab8f76526fd3a0330", 14071036),
    ("0x15642f3827a4e35d2b9e4fc138437811af414a1cea35b906e19828408558e73a", 13985298),
    ("0x970afa34db0fa459ffe1b64f49add0fb4d5841f17c6f75cc408780bb42875d93", 13959446),
    ("0xd8a0644c2cea04b4ce40fd64c44c2ad071d4bcf2a3e9dca1375ef46ba084935b", 13837952),
    ("0xdcc28fa6014cc4570a271dda168202f1951cfb72cf211b8fca87da221995909a", 13506694),
]


async def run_known_backtest(send_telegram: bool = True):
    """Run backtest with known tx hashes."""
    notifier = TelegramNotifier() if send_telegram else None

    if notifier:
        await notifier.send_message(
            f"🧪 Backtest Started (Known TXs)\n"
            f"Testing {len(KNOWN_LIQUIDATION_TXS)} known liquidation transactions"
        )

    results = []
    for i, (tx_hash, block) in enumerate(KNOWN_LIQUIDATION_TXS):
        logger.info(f"[{i+1}/{len(KNOWN_LIQUIDATION_TXS)}] Processing tx: {tx_hash[:16]}... (block {block})")
        try:
            digest_msg = digest_tx(tx_hash)
            results.append({"tx_hash": tx_hash, "status": "ok", "digest": digest_msg})
            print(digest_msg)
            print()

            if notifier:
                await notifier.send_message(digest_msg)

        except Exception as e:
            logger.error(f"Failed: {e}")
            results.append({"tx_hash": tx_hash, "status": "error", "error": str(e)})
            print(f"ERROR processing {tx_hash}: {e}")

    # Summary
    ok_count = sum(1 for r in results if r["status"] == "ok")
    err_count = sum(1 for r in results if r["status"] == "error")
    summary = (
        f"\n{'='*40}\n"
        f"📊 Backtest Summary (Known TXs)\n"
        f"{'='*40}\n"
        f"Total: {len(KNOWN_LIQUIDATION_TXS)}\n"
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
    """CLI entry for known tx backtest."""
    import argparse

    parser = argparse.ArgumentParser(description="Backtest with known liquidation txs")
    parser.add_argument("--no-telegram", action="store_true", help="Disable TG output")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    asyncio.run(run_known_backtest(send_telegram=not args.no_telegram))


if __name__ == "__main__":
    main()
