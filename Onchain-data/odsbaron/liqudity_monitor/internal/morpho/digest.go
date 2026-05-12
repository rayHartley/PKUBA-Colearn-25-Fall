package morpho

import (
	"context"
	"fmt"
	"math"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type Analyzer struct {
	client        *ethclient.Client
	morphoAddress common.Address
}

func NewAnalyzer(client *ethclient.Client, morphoAddress string) *Analyzer {
	return &Analyzer{
		client:        client,
		morphoAddress: common.HexToAddress(morphoAddress),
	}
}

func (a *Analyzer) DigestTx(ctx context.Context, txHash string) (string, error) {
	hash := common.HexToHash(txHash)

	receipt, err := a.client.TransactionReceipt(ctx, hash)
	if err != nil {
		return "", fmt.Errorf("fetch receipt: %w", err)
	}

	events, err := a.parseLiquidations(receipt)
	if err != nil {
		return "", err
	}
	if len(events) == 0 {
		return "", fmt.Errorf("no Liquidate event found in tx %s", txHash)
	}

	block, err := a.client.BlockByNumber(ctx, big.NewInt(int64(receipt.BlockNumber.Uint64())))
	if err != nil {
		return "", fmt.Errorf("fetch block: %w", err)
	}
	tx, _, err := a.client.TransactionByHash(ctx, hash)
	if err != nil {
		return "", fmt.Errorf("fetch tx: %w", err)
	}

	var sections []string
	for _, event := range events {
		digest, err := a.buildDigest(ctx, event, receipt, tx, block)
		if err != nil {
			return "", err
		}
		sections = append(sections, digest)
	}

	return strings.Join(sections, "\n\n"), nil
}

func (a *Analyzer) buildDigest(
	ctx context.Context,
	event LiquidationEvent,
	receipt *types.Receipt,
	tx *types.Transaction,
	block *types.Block,
) (string, error) {
	blockNumber := block.Number()
	marketID := common.BytesToHash(event.MarketID[:])

	params, err := a.marketParamsAt(ctx, marketID, blockNumber)
	if err != nil {
		return "", fmt.Errorf("fetch market params: %w", err)
	}

	oraclePrice, err := a.oraclePriceAt(ctx, common.HexToAddress(params.Oracle), blockNumber)
	if err != nil {
		return "", fmt.Errorf("fetch oracle price: %w", err)
	}

	loanDecimals, err := a.tokenDecimalsAt(ctx, common.HexToAddress(params.LoanToken), blockNumber)
	if err != nil {
		loanDecimals = 18
	}
	collateralDecimals, err := a.tokenDecimalsAt(ctx, common.HexToAddress(params.CollateralToken), blockNumber)
	if err != nil {
		collateralDecimals = 18
	}

	collateralValueRaw := new(big.Int).Mul(event.SeizedAssets, oraclePrice)
	collateralValueRaw.Div(collateralValueRaw, big.NewInt(0).Exp(big.NewInt(10), big.NewInt(36), nil))

	grossRevenueRaw := new(big.Int).Sub(collateralValueRaw, event.RepaidAssets)

	baseFee := block.BaseFee()
	if baseFee == nil {
		baseFee = big.NewInt(0)
	}

	effectiveGasPrice := receipt.EffectiveGasPrice
	if effectiveGasPrice == nil {
		effectiveGasPrice = tx.GasPrice()
	}

	gasUsed := new(big.Int).SetUint64(receipt.GasUsed)
	totalFeeWei := new(big.Int).Mul(gasUsed, effectiveGasPrice)
	baseGasWei := new(big.Int).Mul(gasUsed, baseFee)

	priorityPerGas := new(big.Int).Sub(effectiveGasPrice, baseFee)
	if priorityPerGas.Sign() < 0 {
		priorityPerGas = big.NewInt(0)
	}
	bribeWei := new(big.Int).Mul(gasUsed, priorityPerGas)

	grossHuman := humanize(grossRevenueRaw, loanDecimals)
	repaidHuman := humanize(event.RepaidAssets, loanDecimals)
	seizedHuman := humanize(event.SeizedAssets, collateralDecimals)
	collateralValueHuman := humanize(collateralValueRaw, loanDecimals)
	totalFeeHuman := humanize(totalFeeWei, 18)
	baseGasHuman := humanize(baseGasWei, 18)
	bribeHuman := humanize(bribeWei, 18)

	netProfit := grossHuman - totalFeeHuman
	margin := 0.0
	if grossHuman != 0 {
		margin = netProfit / grossHuman * 100
	}

	timestamp := time.Unix(int64(block.Time()), 0).In(time.FixedZone("UTC+8", 8*3600))
	lines := []string{
		"========================================",
		"Morpho Liquidation",
		"========================================",
		fmt.Sprintf("Time: %s", timestamp.Format("2006-01-02 15:04:05 UTC+8")),
		fmt.Sprintf("Tx: %s", receipt.TxHash.Hex()),
		fmt.Sprintf("Block: %d", block.NumberU64()),
		fmt.Sprintf("Market: %s", marketID.Hex()),
		"",
		fmt.Sprintf("Liquidator: %s", event.Caller),
		fmt.Sprintf("Borrower: %s", event.Borrower),
		"",
		fmt.Sprintf("Repaid (loan): %.6f", repaidHuman),
		fmt.Sprintf("Seized (collateral): %.6f", seizedHuman),
		fmt.Sprintf("Collateral Value (loan): %.6f", collateralValueHuman),
		"",
		fmt.Sprintf("Gross Revenue: %.6f", grossHuman),
		fmt.Sprintf("Gas Cost: %.6f HYPE", baseGasHuman),
		fmt.Sprintf("Bribe (Priority Fee): %.6f HYPE", bribeHuman),
		fmt.Sprintf("Net Profit: %.6f", netProfit),
		fmt.Sprintf("Margin (net/gross): %.2f%%", margin),
	}

	if event.BadDebtAssets != nil && event.BadDebtAssets.Sign() > 0 {
		lines = append(lines, fmt.Sprintf("Bad Debt: %.6f", humanize(event.BadDebtAssets, loanDecimals)))
	}

	lines = append(lines,
		fmt.Sprintf("Loan Token: %s", params.LoanToken),
		fmt.Sprintf("Collateral Token: %s", params.CollateralToken),
		fmt.Sprintf("Oracle Price: %s", oraclePrice.String()),
		"========================================",
	)

	return strings.Join(lines, "\n"), nil
}

func (a *Analyzer) parseLiquidations(receipt *types.Receipt) ([]LiquidationEvent, error) {
	eventABI := MorphoABI.Events["Liquidate"]
	var out []LiquidationEvent

	for _, log := range receipt.Logs {
		if log.Address != a.morphoAddress {
			continue
		}
		if len(log.Topics) == 0 || log.Topics[0] != LiquidateTopic {
			continue
		}
		if len(log.Topics) < 4 {
			continue
		}

		decoded, err := eventABI.Inputs.NonIndexed().Unpack(log.Data)
		if err != nil {
			return nil, fmt.Errorf("unpack liquidate log: %w", err)
		}
		if len(decoded) != 5 {
			return nil, fmt.Errorf("unexpected liquidate field count: %d", len(decoded))
		}

		var marketID [32]byte
		copy(marketID[:], log.Topics[1].Bytes())

		item := LiquidationEvent{
			MarketID:      marketID,
			Caller:        common.BytesToAddress(log.Topics[2].Bytes()).Hex(),
			Borrower:      common.BytesToAddress(log.Topics[3].Bytes()).Hex(),
			RepaidAssets:  decoded[0].(*big.Int),
			RepaidShares:  decoded[1].(*big.Int),
			SeizedAssets:  decoded[2].(*big.Int),
			BadDebtAssets: decoded[3].(*big.Int),
			BadDebtShares: decoded[4].(*big.Int),
		}
		out = append(out, item)
	}

	return out, nil
}

func (a *Analyzer) marketParamsAt(ctx context.Context, marketID common.Hash, blockNumber *big.Int) (MarketParams, error) {
	data, err := MorphoABI.Pack("idToMarketParams", marketID)
	if err != nil {
		return MarketParams{}, err
	}

	msg := ethereum.CallMsg{To: &a.morphoAddress, Data: data}
	raw, err := a.client.CallContract(ctx, msg, blockNumber)
	if err != nil {
		return MarketParams{}, err
	}

	decoded, err := MorphoABI.Unpack("idToMarketParams", raw)
	if err != nil {
		return MarketParams{}, err
	}
	return MarketParams{
		LoanToken:       decoded[0].(common.Address).Hex(),
		CollateralToken: decoded[1].(common.Address).Hex(),
		Oracle:          decoded[2].(common.Address).Hex(),
		IRM:             decoded[3].(common.Address).Hex(),
		LLTV:            decoded[4].(*big.Int),
	}, nil
}

func (a *Analyzer) oraclePriceAt(ctx context.Context, oracle common.Address, blockNumber *big.Int) (*big.Int, error) {
	data, err := OracleABI.Pack("price")
	if err != nil {
		return nil, err
	}
	msg := ethereum.CallMsg{To: &oracle, Data: data}
	raw, err := a.client.CallContract(ctx, msg, blockNumber)
	if err != nil {
		return nil, err
	}
	decoded, err := OracleABI.Unpack("price", raw)
	if err != nil {
		return nil, err
	}
	return decoded[0].(*big.Int), nil
}

func (a *Analyzer) tokenDecimalsAt(ctx context.Context, token common.Address, blockNumber *big.Int) (int, error) {
	data, err := ERC20ABI.Pack("decimals")
	if err != nil {
		return 0, err
	}
	msg := ethereum.CallMsg{To: &token, Data: data}
	raw, err := a.client.CallContract(ctx, msg, blockNumber)
	if err != nil {
		return 0, err
	}
	decoded, err := ERC20ABI.Unpack("decimals", raw)
	if err != nil {
		return 0, err
	}
	return int(decoded[0].(uint8)), nil
}

func humanize(value *big.Int, decimals int) float64 {
	if value == nil {
		return 0
	}

	rat := new(big.Rat).SetInt(value)
	divisor := new(big.Rat).SetFloat64(math.Pow10(decimals))
	result, _ := new(big.Rat).Quo(rat, divisor).Float64()
	return result
}
