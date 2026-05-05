"""CLI entry point for single transaction digest."""

import logging
import sys

from .digest import digest_tx


def main():
    """Analyze a single liquidation transaction."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    if len(sys.argv) < 2:
        print("Usage: uv run digest <tx_hash> [rpc_url]")
        print()
        print("Example:")
        print("  uv run digest 0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b")
        sys.exit(1)

    tx_hash = sys.argv[1]
    rpc_url = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Analyzing liquidation tx: {tx_hash}")
    print()

    result = digest_tx(tx_hash, rpc_url=rpc_url)
    print(result)


if __name__ == "__main__":
    main()
