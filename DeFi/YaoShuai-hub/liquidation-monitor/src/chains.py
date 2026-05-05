"""Multi-market and multi-chain configuration for Challenge extension.

Challenge 1: Monitor ALL Morpho markets on HyperEVM
Challenge 2: Extend to all chains where Morpho is deployed

Data source: Morpho Blue GraphQL API (morphoBlues query)
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


# All known Morpho Blue deployments (from Morpho API)
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
    # Arbitrum One
    42161: ChainConfig(
        chain_id=42161,
        name="Arbitrum",
        morpho_address="0x6c247b1F6182318877311737BaC0844bAa518F5e",
        rpc_http="https://arbitrum.llamarpc.com",
        rpc_wss="wss://arbitrum.llamarpc.com",
        explorer_url="https://arbiscan.io",
        native_token="ETH",
    ),
    # Optimism (OP Mainnet)
    10: ChainConfig(
        chain_id=10,
        name="Optimism",
        morpho_address="0xce95AfbB8EA029495c66020883F87aaE8864AF92",
        rpc_http="https://optimism.llamarpc.com",
        rpc_wss="wss://optimism.llamarpc.com",
        explorer_url="https://optimistic.etherscan.io",
        native_token="ETH",
    ),
    # Polygon
    137: ChainConfig(
        chain_id=137,
        name="Polygon",
        morpho_address="0x1bF0c2541F820E775182832f06c0B7Fc27A25f67",
        rpc_http="https://polygon.llamarpc.com",
        rpc_wss="wss://polygon.llamarpc.com",
        explorer_url="https://polygonscan.com",
        native_token="MATIC",
    ),
    # World Chain
    480: ChainConfig(
        chain_id=480,
        name="World Chain",
        morpho_address="0xE741BC7c34758b4caE05062794E8Ae24978AF432",
        rpc_http="https://worldchain-mainnet.g.alchemy.com/public",
        rpc_wss="wss://worldchain-mainnet.g.alchemy.com/public",
        explorer_url="https://worldscan.org",
        native_token="ETH",
    ),
    # Unichain
    130: ChainConfig(
        chain_id=130,
        name="Unichain",
        morpho_address="0x8f5ae9CddB9f68de460C77730b018Ae7E04a140A",
        rpc_http="https://mainnet.unichain.org",
        rpc_wss="wss://mainnet.unichain.org",
        explorer_url="https://uniscan.xyz",
        native_token="ETH",
    ),
    # Monad
    143: ChainConfig(
        chain_id=143,
        name="Monad",
        morpho_address="0xD5D960E8C380B724a48AC59E2DfF1b2CB4a1eAee",
        rpc_http="https://monad-mainnet.g.alchemy.com/v2/public",
        rpc_wss="wss://monad-mainnet.g.alchemy.com/v2/public",
        explorer_url="https://monadexplorer.com",
        native_token="MON",
    ),
    # Katana
    747474: ChainConfig(
        chain_id=747474,
        name="Katana",
        morpho_address="0xD50F2DffFd62f94Ee4AEd9ca05C61d0753268aBc",
        rpc_http="https://rpc.katana.network",
        rpc_wss="wss://rpc.katana.network",
        explorer_url="https://explorer.katana.network",
        native_token="ETH",
    ),
    # Stable
    988: ChainConfig(
        chain_id=988,
        name="Stable",
        morpho_address="0xa40103088A899514E3fe474cD3cc5bf811b1102e",
        rpc_http="https://rpc.stable.network",
        rpc_wss="wss://rpc.stable.network",
        explorer_url="https://explorer.stable.network",
        native_token="ETH",
    ),
    # Tempo Mainnet
    4217: ChainConfig(
        chain_id=4217,
        name="Tempo",
        morpho_address="0x10EE9AAC980A180dd4DcFc96C746d60B0EA88f97",
        rpc_http="https://rpc.tempo.network",
        rpc_wss="wss://rpc.tempo.network",
        explorer_url="https://explorer.tempo.network",
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
