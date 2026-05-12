package morpho

import (
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/crypto"
)

const morphoABIJSON = `[
  {
    "inputs": [{"internalType": "bytes32", "name": "id", "type": "bytes32"}],
    "name": "idToMarketParams",
    "outputs": [
      {"internalType": "address", "name": "loanToken", "type": "address"},
      {"internalType": "address", "name": "collateralToken", "type": "address"},
      {"internalType": "address", "name": "oracle", "type": "address"},
      {"internalType": "address", "name": "irm", "type": "address"},
      {"internalType": "uint256", "name": "lltv", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "id", "type": "bytes32"},
      {"indexed": true, "internalType": "address", "name": "caller", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "borrower", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "repaidAssets", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "repaidShares", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "seizedAssets", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "badDebtAssets", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "badDebtShares", "type": "uint256"}
    ],
    "name": "Liquidate",
    "type": "event"
  }
]`

const oracleABIJSON = `[
  {
    "inputs": [],
    "name": "price",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
]`

const erc20ABIJSON = `[
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"internalType": "uint8", "name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  }
]`

var (
	MorphoABI      = mustParseABI(morphoABIJSON)
	OracleABI      = mustParseABI(oracleABIJSON)
	ERC20ABI       = mustParseABI(erc20ABIJSON)
	LiquidateTopic = crypto.Keccak256Hash([]byte("Liquidate(bytes32,address,address,uint256,uint256,uint256,uint256,uint256)"))
)

func mustParseABI(raw string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(raw))
	if err != nil {
		panic(err)
	}
	return parsed
}
