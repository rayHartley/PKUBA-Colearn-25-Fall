package morpho

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
)

const officialHistoryQuery = `
query OfficialLiquidations($first: Int!, $skip: Int!, $keys: [String!], $types: [MarketTransactionType!], $chains: [Int!]) {
  marketTransactions(
    first: $first
    skip: $skip
    orderBy: Timestamp
    orderDirection: Asc
    where: { marketUniqueKey_in: $keys, type_in: $types, chainId_in: $chains }
  ) {
    items {
      txHash
      blockNumber
      txIndex
      logIndex
      type
    }
    pageInfo {
      count
      countTotal
      limit
      skip
    }
  }
}`

type OfficialHistoryClient struct {
	url        string
	httpClient *http.Client
}

type OfficialLiquidation struct {
	TxHash      string `json:"txHash"`
	BlockNumber int64  `json:"blockNumber"`
	TxIndex     int    `json:"txIndex"`
	LogIndex    int    `json:"logIndex"`
	Type        string `json:"type"`
}

type OfficialCoverageReport struct {
	OfficialCount  int
	OnChainCount   int
	MissingOnChain []string
	ExtraOnChain   []string
	FromBlock      int64
	ToBlock        int64
	VerifiedBlocks int
}

type officialHistoryResponse struct {
	Data struct {
		MarketTransactions struct {
			Items    []OfficialLiquidation `json:"items"`
			PageInfo struct {
				CountTotal int `json:"countTotal"`
			} `json:"pageInfo"`
		} `json:"marketTransactions"`
	} `json:"data"`
	Errors []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

func NewOfficialHistoryClient(url string) *OfficialHistoryClient {
	return &OfficialHistoryClient{
		url:        url,
		httpClient: &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *OfficialHistoryClient) FetchLiquidations(
	ctx context.Context,
	marketID string,
	chainID int,
) ([]OfficialLiquidation, error) {
	const pageSize = 100

	var all []OfficialLiquidation
	skip := 0
	total := -1

	for {
		payload := map[string]any{
			"query": officialHistoryQuery,
			"variables": map[string]any{
				"first":  pageSize,
				"skip":   skip,
				"keys":   []string{marketID},
				"types":  []string{"Liquidation"},
				"chains": []int{chainID},
			},
		}

		body, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, err
		}

		var decoded officialHistoryResponse
		err = json.NewDecoder(resp.Body).Decode(&decoded)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= 300 {
			return nil, fmt.Errorf("official history query failed: %s", resp.Status)
		}
		if len(decoded.Errors) > 0 {
			return nil, fmt.Errorf("official history graphql error: %s", decoded.Errors[0].Message)
		}

		items := decoded.Data.MarketTransactions.Items
		all = append(all, items...)
		total = decoded.Data.MarketTransactions.PageInfo.CountTotal

		skip += len(items)
		if len(items) == 0 || skip >= total {
			break
		}
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].BlockNumber != all[j].BlockNumber {
			return all[i].BlockNumber < all[j].BlockNumber
		}
		if all[i].TxIndex != all[j].TxIndex {
			return all[i].TxIndex < all[j].TxIndex
		}
		return all[i].LogIndex < all[j].LogIndex
	})

	return all, nil
}

func BuildCoverageReport(official []OfficialLiquidation, onchain []common.Hash) OfficialCoverageReport {
	report := OfficialCoverageReport{
		OfficialCount: len(official),
		OnChainCount:  len(onchain),
	}

	if len(official) > 0 {
		report.FromBlock = official[0].BlockNumber
		report.ToBlock = official[len(official)-1].BlockNumber
	}

	officialSet := make(map[string]struct{}, len(official))
	for _, item := range official {
		officialSet[strings.ToLower(item.TxHash)] = struct{}{}
	}

	onchainSet := make(map[string]struct{}, len(onchain))
	for _, hash := range onchain {
		onchainSet[strings.ToLower(hash.Hex())] = struct{}{}
	}

	for _, item := range official {
		key := strings.ToLower(item.TxHash)
		if _, ok := onchainSet[key]; !ok {
			report.MissingOnChain = append(report.MissingOnChain, item.TxHash)
		}
	}

	for _, hash := range onchain {
		key := strings.ToLower(hash.Hex())
		if _, ok := officialSet[key]; !ok {
			report.ExtraOnChain = append(report.ExtraOnChain, hash.Hex())
		}
	}

	sort.Strings(report.MissingOnChain)
	sort.Strings(report.ExtraOnChain)
	return report
}
