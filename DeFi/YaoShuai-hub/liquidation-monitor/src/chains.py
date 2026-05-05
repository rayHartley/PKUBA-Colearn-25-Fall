"""Multi-market and multi-chain configuration for Challenge extension.

Challenge 1: Monitor ALL Morpho markets on HyperEVM
Challenge 2: Extend to all chains where Morpho is deployed
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ChainConfig:
    """Configuration for a Morpho Blue deployment on a specific chain."""
    chain_id: int
    name: str
    morpho_address: str
    rpc_http: str
    rpc_wss: str
    explorer_url: str
    native_token: str
    native_decimals: int = 18


# All known Morpho Blue deployments
CHAIN_CONFIGS: dict[int, ChainConfig] = {
    # HyperEVM
    999: ChainConfig(
        chain_id=999,
        name="HyperEVM",
        morpho_address="0x68e37dE8d93d3496ae143F2E900490f6280C57cD",
        rpc_http="https://rpc.hyperliquid.xyz/evm",
        rpc_wss="wss://rpc.hyperliquid.xyz/evm",
        explorer_url="https://hyperevmscan.io",
        native_token="HYPE",
    ),
    # Ethereum Mainnet
    1: ChainConfig(
        chain_id=1,
        name="Ethereum",
        morpho_address="0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        rpc_http="https://eth.llamarpc.com",
        rpc_wss="wss://eth.llamarpc.com",
        explorer_url="https://etherscan.io",
        native_token="ETH",
    ),
    # Base
    8453: ChainConfig(
        chain_id=8453,
        name="Base",
        morpho_address="0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        rpc_http="https://base.llamarpc.com",
        rpc_wss="wss://base.llamarpc.com",
        explorer_url="https://basescan.org",
        native_token="ETH",
    ),
}


def get_chain_config(chain_id: int) -> ChainConfig:
    """Get chain configuration by chain ID."""
    if chain_id not in CHAIN_CONFIGS:
        raise ValueError(
            f"Unknown chain ID: {chain_id}. "
            f"Supported chains: {list(CHAIN_CONFIGS.keys())}"
        )
    return CHAIN_CONFIGS[chain_id]
