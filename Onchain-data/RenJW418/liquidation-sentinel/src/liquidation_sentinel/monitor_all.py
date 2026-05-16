import threading

from .chains import CHAINS
from .monitor import monitor_market


def monitor_all_markets(chain_id: int) -> None:
    monitor_market(chain_id, market_id=None)


def monitor_all_chains() -> None:
    threads = []
    for chain_id in CHAINS:
        t = threading.Thread(target=monitor_market, args=(chain_id, None), daemon=True)
        t.start()
        threads.append(t)

    for t in threads:
        t.join()
