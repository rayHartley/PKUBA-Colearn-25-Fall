package config

import (
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

const (
	DefaultRPCURL    = "https://rpc.hyperliquid.xyz/evm"
	DefaultMorpho    = "0x68e37dE8d93d3496ae143F2E900490f6280C57cD"
	DefaultMarketID  = "0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc"
	DefaultPollSec   = 8
	DefaultChunkSize = 1000
	DefaultMorphoGQL = "https://blue-api.morpho.org/graphql"
)

type Config struct {
	RPCURL          string
	WSSURL          string
	MorphoAddress   string
	MarketID        string
	TelegramToken   string
	TelegramChatID  string
	PollIntervalSec int
	BackfillChunk   int64
	MorphoGraphQL   string
}

func Load() Config {
	_ = godotenv.Load()

	return Config{
		RPCURL:          getenv("HYPER_RPC_HTTP", DefaultRPCURL),
		WSSURL:          os.Getenv("HYPER_RPC_WSS"),
		MorphoAddress:   getenv("MORPHO_ADDRESS", DefaultMorpho),
		MarketID:        getenv("MARKET_ID", DefaultMarketID),
		TelegramToken:   os.Getenv("TELEGRAM_TOKEN"),
		TelegramChatID:  os.Getenv("TELEGRAM_CHAT_ID"),
		PollIntervalSec: getenvInt("POLL_INTERVAL_SECONDS", DefaultPollSec),
		BackfillChunk:   int64(getenvInt("BACKFILL_CHUNK_SIZE", DefaultChunkSize)),
		MorphoGraphQL:   getenv("MORPHO_GRAPHQL_URL", DefaultMorphoGQL),
	}
}

func getenv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getenvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}
