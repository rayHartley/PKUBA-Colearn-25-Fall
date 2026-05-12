package morpho

import (
	"context"
	"fmt"
	"log"
	"math/big"
	"sort"
	"time"

	"github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
)

type MessageSender interface {
	Send(context.Context, string) error
}

type Monitor struct {
	client        *ethclient.Client
	analyzer      *Analyzer
	morphoAddress common.Address
	marketID      common.Hash
}

func NewMonitor(client *ethclient.Client, morphoAddress, marketID string) *Monitor {
	return &Monitor{
		client:        client,
		analyzer:      NewAnalyzer(client, morphoAddress),
		morphoAddress: common.HexToAddress(morphoAddress),
		marketID:      common.HexToHash(marketID),
	}
}

func (m *Monitor) Run(ctx context.Context, pollInterval time.Duration, sender MessageSender) error {
	lastBlock, err := m.client.BlockNumber(ctx)
	if err != nil {
		return fmt.Errorf("get latest block: %w", err)
	}

	log.Printf("monitor start from block %d", lastBlock)

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(pollInterval):
		}

		current, err := m.client.BlockNumber(ctx)
		if err != nil {
			log.Printf("poll latest block error: %v", err)
			continue
		}
		if current <= lastBlock {
			continue
		}

		hashes, err := m.FetchTxHashes(ctx, lastBlock+1, current)
		if err != nil {
			log.Printf("fetch tx hashes error: %v", err)
			lastBlock = current
			continue
		}

		for _, txHash := range hashes {
			msg, err := m.analyzer.DigestTx(ctx, txHash.Hex())
			if err != nil {
				log.Printf("digest tx %s error: %v", txHash.Hex(), err)
				continue
			}
			if err := sender.Send(ctx, msg); err != nil {
				log.Printf("send digest error: %v", err)
			}
		}

		lastBlock = current
	}
}

func (m *Monitor) RunSubscribe(
	ctx context.Context,
	wsClient *ethclient.Client,
	pollInterval time.Duration,
	sender MessageSender,
) error {
	query := ethereum.FilterQuery{
		Addresses: []common.Address{m.morphoAddress},
		Topics:    [][]common.Hash{{LiquidateTopic}, {m.marketID}},
	}

	logsCh := make(chan types.Log, 128)
	sub, err := wsClient.SubscribeFilterLogs(ctx, query, logsCh)
	if err != nil {
		return fmt.Errorf("subscribe filter logs: %w", err)
	}
	defer sub.Unsubscribe()

	seen := make(map[common.Hash]struct{})

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case err := <-sub.Err():
			if err != nil {
				return fmt.Errorf("subscription error: %w", err)
			}
			return nil
		case eventLog := <-logsCh:
			if _, ok := seen[eventLog.TxHash]; ok {
				continue
			}
			seen[eventLog.TxHash] = struct{}{}

			msg, err := m.analyzer.DigestTx(ctx, eventLog.TxHash.Hex())
			if err != nil {
				log.Printf("digest tx %s error: %v", eventLog.TxHash.Hex(), err)
				continue
			}
			if err := sender.Send(ctx, msg); err != nil {
				log.Printf("send digest error: %v", err)
			}
		case <-time.After(pollInterval * 3):
			log.Printf("subscription alive")
		}
	}
}

func (m *Monitor) Backfill(ctx context.Context, fromBlock, toBlock, chunkSize int64, sender MessageSender) error {
	if chunkSize <= 0 {
		chunkSize = 1000
	}
	if toBlock < fromBlock {
		return fmt.Errorf("to-block must be >= from-block")
	}

	current := fromBlock
	for current <= toBlock {
		end := current + chunkSize - 1
		if end > toBlock {
			end = toBlock
		}

		hashes, err := m.FetchTxHashes(ctx, uint64(current), uint64(end))
		if err != nil {
			return err
		}

		for _, txHash := range hashes {
			msg, err := m.analyzer.DigestTx(ctx, txHash.Hex())
			if err != nil {
				log.Printf("digest tx %s error: %v", txHash.Hex(), err)
				continue
			}
			if err := sender.Send(ctx, msg); err != nil {
				log.Printf("send digest error: %v", err)
			}
		}

		current = end + 1
	}

	return nil
}

func (m *Monitor) CollectTxHashes(ctx context.Context, fromBlock, toBlock, chunkSize int64) ([]common.Hash, error) {
	if chunkSize <= 0 {
		chunkSize = 1000
	}
	if toBlock < fromBlock {
		return nil, fmt.Errorf("to-block must be >= from-block")
	}

	var hashes []common.Hash
	seen := make(map[common.Hash]struct{})

	current := fromBlock
	for current <= toBlock {
		end := current + chunkSize - 1
		if end > toBlock {
			end = toBlock
		}

		chunkHashes, err := m.FetchTxHashes(ctx, uint64(current), uint64(end))
		if err != nil {
			return nil, err
		}
		for _, txHash := range chunkHashes {
			if _, ok := seen[txHash]; ok {
				continue
			}
			seen[txHash] = struct{}{}
			hashes = append(hashes, txHash)
		}

		current = end + 1
	}

	return hashes, nil
}

func (m *Monitor) CollectTxHashesForBlocks(ctx context.Context, blocks []int64) ([]common.Hash, error) {
	if len(blocks) == 0 {
		return nil, nil
	}

	unique := make(map[int64]struct{}, len(blocks))
	for _, block := range blocks {
		unique[block] = struct{}{}
	}

	ordered := make([]int64, 0, len(unique))
	for block := range unique {
		ordered = append(ordered, block)
	}
	sort.Slice(ordered, func(i, j int) bool { return ordered[i] < ordered[j] })

	seen := make(map[common.Hash]struct{})
	var hashes []common.Hash

	for _, block := range ordered {
		blockHashes, err := m.FetchTxHashes(ctx, uint64(block), uint64(block))
		if err != nil {
			return nil, err
		}
		for _, txHash := range blockHashes {
			if _, ok := seen[txHash]; ok {
				continue
			}
			seen[txHash] = struct{}{}
			hashes = append(hashes, txHash)
		}
	}

	return hashes, nil
}

func (m *Monitor) FetchTxHashes(ctx context.Context, fromBlock, toBlock uint64) ([]common.Hash, error) {
	query := ethereum.FilterQuery{
		FromBlock: big.NewInt(int64(fromBlock)),
		ToBlock:   big.NewInt(int64(toBlock)),
		Addresses: []common.Address{m.morphoAddress},
		Topics:    [][]common.Hash{{LiquidateTopic}, {m.marketID}},
	}

	logs, err := m.client.FilterLogs(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("filter logs %d-%d: %w", fromBlock, toBlock, err)
	}

	sort.Slice(logs, func(i, j int) bool {
		return compareLogs(logs[i], logs[j])
	})

	seen := make(map[common.Hash]struct{})
	var hashes []common.Hash
	for _, item := range logs {
		if _, ok := seen[item.TxHash]; ok {
			continue
		}
		seen[item.TxHash] = struct{}{}
		hashes = append(hashes, item.TxHash)
	}

	return hashes, nil
}

func compareLogs(a, b types.Log) bool {
	if a.BlockNumber != b.BlockNumber {
		return a.BlockNumber < b.BlockNumber
	}
	if a.TxIndex != b.TxIndex {
		return a.TxIndex < b.TxIndex
	}
	return a.Index < b.Index
}
