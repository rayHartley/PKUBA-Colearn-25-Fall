package morpho

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
)

func TestHumanize(t *testing.T) {
	value := big.NewInt(1234567890000000000)
	got := humanize(value, 18)
	want := 1.23456789

	if got != want {
		t.Fatalf("humanize() = %v, want %v", got, want)
	}
}

func TestParseLiquidations(t *testing.T) {
	morphoAddress := "0x68e37dE8d93d3496ae143F2E900490f6280C57cD"
	analyzer := &Analyzer{morphoAddress: common.HexToAddress(morphoAddress)}

	marketID := common.HexToHash("0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc")
	caller := common.HexToAddress("0x7250F80367c82452e843d292778b3dab346ad387")
	borrower := common.HexToAddress("0xd3d7091ACe5518FafCfFf9E18b6F1D0A24Ec637a")

	repaidAssets := big.NewInt(100)
	repaidShares := big.NewInt(101)
	seizedAssets := big.NewInt(102)
	badDebtAssets := big.NewInt(103)
	badDebtShares := big.NewInt(104)

	eventABI := MorphoABI.Events["Liquidate"]
	data, err := eventABI.Inputs.NonIndexed().Pack(
		repaidAssets,
		repaidShares,
		seizedAssets,
		badDebtAssets,
		badDebtShares,
	)
	if err != nil {
		t.Fatalf("pack event data: %v", err)
	}

	receipt := &types.Receipt{
		Logs: []*types.Log{
			{
				Address: common.HexToAddress(morphoAddress),
				Topics: []common.Hash{
					LiquidateTopic,
					marketID,
					common.BytesToHash(common.LeftPadBytes(caller.Bytes(), 32)),
					common.BytesToHash(common.LeftPadBytes(borrower.Bytes(), 32)),
				},
				Data: data,
			},
		},
	}

	events, err := analyzer.parseLiquidations(receipt)
	if err != nil {
		t.Fatalf("parseLiquidations() error = %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("parseLiquidations() len = %d, want 1", len(events))
	}

	got := events[0]
	if got.Caller != caller.Hex() {
		t.Fatalf("caller = %s, want %s", got.Caller, caller.Hex())
	}
	if got.Borrower != borrower.Hex() {
		t.Fatalf("borrower = %s, want %s", got.Borrower, borrower.Hex())
	}
	if got.RepaidAssets.Cmp(repaidAssets) != 0 {
		t.Fatalf("repaidAssets = %s, want %s", got.RepaidAssets, repaidAssets)
	}
	if got.SeizedAssets.Cmp(seizedAssets) != 0 {
		t.Fatalf("seizedAssets = %s, want %s", got.SeizedAssets, seizedAssets)
	}
	if got.BadDebtAssets.Cmp(badDebtAssets) != 0 {
		t.Fatalf("badDebtAssets = %s, want %s", got.BadDebtAssets, badDebtAssets)
	}
}
