package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"odsbaron-liquidation-monitor/internal/config"
	"odsbaron-liquidation-monitor/internal/morpho"
	"odsbaron-liquidation-monitor/internal/telegram"

	"github.com/ethereum/go-ethereum/ethclient"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	cfg := config.Load()

	switch os.Args[1] {
	case "digest":
		runDigest(cfg, os.Args[2:])
	case "monitor":
		runMonitor(cfg, os.Args[2:])
	case "backfill":
		runBackfill(cfg, os.Args[2:])
	case "verify-official":
		runVerifyOfficial(cfg, os.Args[2:])
	default:
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage:")
	fmt.Println("  go run ./cmd/liquidation-monitor digest --tx <tx_hash>")
	fmt.Println("  go run ./cmd/liquidation-monitor monitor")
	fmt.Println("  go run ./cmd/liquidation-monitor backfill --from-block <n> --to-block <n>")
	fmt.Println("  go run ./cmd/liquidation-monitor verify-official")
}

func runDigest(cfg config.Config, args []string) {
	fs := flag.NewFlagSet("digest", flag.ExitOnError)
	txHash := fs.String("tx", "", "transaction hash")
	_ = fs.Parse(args)

	if *txHash == "" {
		log.Fatal("--tx is required")
	}

	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		log.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	analyzer := morpho.NewAnalyzer(client, cfg.MorphoAddress)
	msg, err := analyzer.DigestTx(context.Background(), *txHash)
	if err != nil {
		log.Fatalf("digest tx: %v", err)
	}
	fmt.Println(msg)
}

func runMonitor(cfg config.Config, args []string) {
	fs := flag.NewFlagSet("monitor", flag.ExitOnError)
	_ = fs.Parse(args)

	httpClient, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		log.Fatalf("dial rpc: %v", err)
	}
	defer httpClient.Close()

	monitor := morpho.NewMonitor(httpClient, cfg.MorphoAddress, cfg.MarketID)
	notifier := telegram.New(cfg.TelegramToken, cfg.TelegramChatID)

	if cfg.WSSURL != "" {
		wsClient, err := ethclient.Dial(cfg.WSSURL)
		if err != nil {
			log.Printf("dial wss rpc failed, fallback to polling: %v", err)
		} else {
			defer wsClient.Close()
			err = monitor.RunSubscribe(
				context.Background(),
				wsClient,
				time.Duration(cfg.PollIntervalSec)*time.Second,
				notifier,
			)
			if err == nil {
				return
			}
			log.Printf("monitor subscribe failed, fallback to polling: %v", err)
		}
	}

	err = monitor.Run(context.Background(), time.Duration(cfg.PollIntervalSec)*time.Second, notifier)
	if err != nil {
		log.Fatalf("monitor polling run: %v", err)
	}
}

func runBackfill(cfg config.Config, args []string) {
	fs := flag.NewFlagSet("backfill", flag.ExitOnError)
	fromBlock := fs.Int64("from-block", 0, "start block")
	toBlock := fs.Int64("to-block", 0, "end block")
	_ = fs.Parse(args)

	if *fromBlock <= 0 || *toBlock <= 0 {
		log.Fatal("--from-block and --to-block are required")
	}

	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		log.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	monitor := morpho.NewMonitor(client, cfg.MorphoAddress, cfg.MarketID)
	notifier := telegram.New(cfg.TelegramToken, cfg.TelegramChatID)

	if err := monitor.Backfill(context.Background(), *fromBlock, *toBlock, cfg.BackfillChunk, notifier); err != nil {
		log.Fatalf("backfill: %v", err)
	}
}

func runVerifyOfficial(cfg config.Config, args []string) {
	fs := flag.NewFlagSet("verify-official", flag.ExitOnError)
	_ = fs.Parse(args)

	client, err := ethclient.Dial(cfg.RPCURL)
	if err != nil {
		log.Fatalf("dial rpc: %v", err)
	}
	defer client.Close()

	monitor := morpho.NewMonitor(client, cfg.MorphoAddress, cfg.MarketID)
	officialClient := morpho.NewOfficialHistoryClient(cfg.MorphoGraphQL)

	ctx := context.Background()
	official, err := officialClient.FetchLiquidations(ctx, cfg.MarketID, 999)
	if err != nil {
		log.Fatalf("fetch official history: %v", err)
	}
	if len(official) == 0 {
		log.Fatal("official history returned zero liquidations")
	}

	blocks := make([]int64, 0, len(official))
	for _, item := range official {
		blocks = append(blocks, item.BlockNumber)
	}

	onchain, err := monitor.CollectTxHashesForBlocks(ctx, blocks)
	if err != nil {
		log.Fatalf("collect onchain tx hashes: %v", err)
	}

	report := morpho.BuildCoverageReport(official, onchain)
	report.VerifiedBlocks = len(blocks)

	fmt.Printf("Official count: %d\n", report.OfficialCount)
	fmt.Printf("On-chain count: %d\n", report.OnChainCount)
	fmt.Printf("Compared block range: %d -> %d\n", report.FromBlock, report.ToBlock)
	fmt.Printf("Verified official event blocks: %d\n", report.VerifiedBlocks)
	fmt.Printf("Missing on-chain: %d\n", len(report.MissingOnChain))
	for _, item := range report.MissingOnChain {
		fmt.Printf("  MISSING %s\n", item)
	}
	fmt.Printf("Extra on-chain: %d\n", len(report.ExtraOnChain))
	for _, item := range report.ExtraOnChain {
		fmt.Printf("  EXTRA   %s\n", item)
	}

	if len(report.MissingOnChain) == 0 && len(report.ExtraOnChain) == 0 {
		fmt.Println("Coverage matches official Morpho history.")
	}
}
