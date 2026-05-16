from dataclasses import dataclass


@dataclass(frozen=True)
class ChainConfig:
    chain_id: int
    name: str
    rpc_http_env: str
    rpc_wss_env: str
    morpho_address: str
    default_market_ids: list[str]


CHAINS: dict[int, ChainConfig] = {
    999: ChainConfig(
        chain_id=999,
        name="HyperEVM",
        rpc_http_env="HYPEREVM_HTTP_RPC",
        rpc_wss_env="HYPEREVM_WSS_RPC",
        morpho_address="0x68e37dE8d93d3496ae143F2E900490f6280C57cD",
        default_market_ids=[
            "0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc"
        ],
    ),
    1: ChainConfig(
        chain_id=1,
        name="Ethereum",
        rpc_http_env="ETHEREUM_HTTP_RPC",
        rpc_wss_env="ETHEREUM_WSS_RPC",
        morpho_address="0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        default_market_ids=[],
    ),
    8453: ChainConfig(
        chain_id=8453,
        name="Base",
        rpc_http_env="BASE_HTTP_RPC",
        rpc_wss_env="BASE_WSS_RPC",
        morpho_address="0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb",
        default_market_ids=[],
    ),
}
