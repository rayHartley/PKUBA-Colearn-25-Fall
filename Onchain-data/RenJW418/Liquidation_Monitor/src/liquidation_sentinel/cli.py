import typer

from .chains import CHAINS
from .config import DEFAULT_CHAIN_ID, get_chain
from .digest import digest_tx
from .monitor import monitor_market
from .monitor_all import monitor_all_chains, monitor_all_markets
from .backtest import backtest

app = typer.Typer(add_completion=False)


@app.command()
def digest(tx_hash: str, chain_id: int = DEFAULT_CHAIN_ID) -> None:
    """Analyze a single liquidation transaction."""
    message = digest_tx(tx_hash, chain_id)
    print(message)


@app.command()
def monitor(chain_id: int = DEFAULT_CHAIN_ID, market_id: str | None = None) -> None:
    """Monitor a single market on one chain."""
    chain = get_chain(chain_id)
    market = market_id or (chain.default_market_ids[0] if chain.default_market_ids else None)
    if not market:
        raise typer.BadParameter("market_id is required for this chain")
    monitor_market(chain_id, market_id=market)


@app.command(name="monitor-all")
def monitor_all(chain_id: int | None = None, all_chains: bool = False) -> None:
    """Monitor all markets for one chain or all configured chains."""
    if all_chains:
        monitor_all_chains()
        return
    chain_id = chain_id or DEFAULT_CHAIN_ID
    if chain_id not in CHAINS:
        raise typer.BadParameter("unknown chain_id")
    monitor_all_markets(chain_id)


@app.command(name="backtest")
def backtest_cmd(
    from_block: int = typer.Option(..., "--from-block"),
    to_block: int = typer.Option(..., "--to-block"),
    chain_id: int = DEFAULT_CHAIN_ID,
    market_id: str | None = None,
) -> None:
    """Backtest liquidation events from historical logs."""
    backtest(chain_id, from_block, to_block, market_id)
