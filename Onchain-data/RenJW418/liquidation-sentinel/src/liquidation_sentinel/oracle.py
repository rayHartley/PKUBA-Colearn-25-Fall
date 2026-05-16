from web3 import Web3
from .abi import ORACLE_ABI


def get_oracle_price(w3: Web3, oracle_address: str, block_number: int) -> int:
    oracle = w3.eth.contract(address=oracle_address, abi=ORACLE_ABI)
    return oracle.functions.price().call(block_identifier=block_number)
