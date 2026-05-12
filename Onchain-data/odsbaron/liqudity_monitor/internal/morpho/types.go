package morpho

import "math/big"

type MarketParams struct {
	LoanToken       string
	CollateralToken string
	Oracle          string
	IRM             string
	LLTV            *big.Int
}

type LiquidationEvent struct {
	MarketID      [32]byte
	Caller        string
	Borrower      string
	RepaidAssets  *big.Int
	RepaidShares  *big.Int
	SeizedAssets  *big.Int
	BadDebtAssets *big.Int
	BadDebtShares *big.Int
}
