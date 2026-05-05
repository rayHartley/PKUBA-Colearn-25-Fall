package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	defaultProfitToken = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
	transferTopic      = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
)

type rpcClient struct {
	url    string
	http   *http.Client
	nextID int
}

type rpcRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	ID      int           `json:"id"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
}

type rpcResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int             `json:"id"`
	Result  json.RawMessage `json:"result"`
	Error   *rpcError       `json:"error"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type receipt struct {
	BlockNumber       string   `json:"blockNumber"`
	EffectiveGasPrice string   `json:"effectiveGasPrice"`
	GasUsed           string   `json:"gasUsed"`
	Logs              []ethLog `json:"logs"`
	To                string   `json:"to"`
	TransactionHash   string   `json:"transactionHash"`
}

type blockHeader struct {
	BaseFeePerGas string `json:"baseFeePerGas"`
	Number        string `json:"number"`
	Timestamp     string `json:"timestamp"`
}

type ethLog struct {
	Address string   `json:"address"`
	Topics  []string `json:"topics"`
	Data    string   `json:"data"`
}

type txProfit struct {
	TxHash               string
	BotAddress           string
	ProfitToken          string
	GrossRevenueWei      *big.Int
	BaseFeeCostWei       *big.Int
	PriorityFeeWei       *big.Int
	TotalGasFeeWei       *big.Int
	NetProfitWei         *big.Int
	MarginPercent        string
	GasUsed              *big.Int
	EffectiveGasPriceWei *big.Int
	BaseFeePerGasWei     *big.Int
}

type aggregate struct {
	Count          int
	GrossRevenue   *big.Int
	NetProfit      *big.Int
	BaseFeeCost    *big.Int
	PriorityFee    *big.Int
	TotalGasFee    *big.Int
	SkippedTxs     []string
	ProfitToken    string
	FirstBotSeen   string
	AnalyzedTxFile string
}

func newRPCClient(url string) *rpcClient {
	return &rpcClient{
		url: url,
		http: &http.Client{
			Timeout: 30 * time.Second,
		},
		nextID: 1,
	}
}

func (c *rpcClient) call(ctx context.Context, method string, params []interface{}, out interface{}) error {
	reqBody, err := json.Marshal(rpcRequest{
		JSONRPC: "2.0",
		ID:      c.nextID,
		Method:  method,
		Params:  params,
	})
	if err != nil {
		return err
	}
	c.nextID++

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.url, bytes.NewReader(reqBody))
	if err != nil {
		return err
	}
	req.Header.Set("content-type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return fmt.Errorf("rpc http status %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var decoded rpcResponse
	if err := json.NewDecoder(resp.Body).Decode(&decoded); err != nil {
		return err
	}
	if decoded.Error != nil {
		return fmt.Errorf("rpc %s failed: %d %s", method, decoded.Error.Code, decoded.Error.Message)
	}
	if len(decoded.Result) == 0 || string(decoded.Result) == "null" {
		return fmt.Errorf("rpc %s returned null result", method)
	}
	return json.Unmarshal(decoded.Result, out)
}

func analyzeTx(ctx context.Context, client *rpcClient, txHash string, profitToken string) (*txProfit, error) {
	var rcpt receipt
	if err := client.call(ctx, "eth_getTransactionReceipt", []interface{}{txHash}, &rcpt); err != nil {
		return nil, err
	}
	if rcpt.To == "" {
		return nil, errors.New("receipt has empty to address; pass a normal bot contract transaction")
	}

	var block blockHeader
	if err := client.call(ctx, "eth_getBlockByNumber", []interface{}{rcpt.BlockNumber, false}, &block); err != nil {
		return nil, err
	}

	bot := normalizeAddress(rcpt.To)
	token := normalizeAddress(profitToken)
	incoming := new(big.Int)
	outgoing := new(big.Int)

	for _, log := range rcpt.Logs {
		if normalizeAddress(log.Address) != token || len(log.Topics) < 3 {
			continue
		}
		if strings.ToLower(log.Topics[0]) != transferTopic {
			continue
		}

		value, err := parseHexBig(log.Data)
		if err != nil {
			return nil, fmt.Errorf("parse transfer value in %s: %w", txHash, err)
		}
		from, err := topicAddress(log.Topics[1])
		if err != nil {
			return nil, err
		}
		to, err := topicAddress(log.Topics[2])
		if err != nil {
			return nil, err
		}

		if to == bot {
			incoming.Add(incoming, value)
		}
		if from == bot {
			outgoing.Add(outgoing, value)
		}
	}

	gross := new(big.Int).Sub(incoming, outgoing)
	if gross.Sign() <= 0 {
		return nil, fmt.Errorf("non-positive %s gross revenue for bot %s: %s", token, bot, gross.String())
	}

	gasUsed, err := parseHexBig(rcpt.GasUsed)
	if err != nil {
		return nil, fmt.Errorf("parse gasUsed: %w", err)
	}
	effectiveGasPrice, err := parseHexBig(rcpt.EffectiveGasPrice)
	if err != nil {
		return nil, fmt.Errorf("parse effectiveGasPrice: %w", err)
	}
	baseFeePerGas, err := parseHexBig(block.BaseFeePerGas)
	if err != nil {
		return nil, fmt.Errorf("parse baseFeePerGas: %w", err)
	}

	baseFeeCost := new(big.Int).Mul(gasUsed, baseFeePerGas)
	priorityFeePerGas := new(big.Int).Sub(effectiveGasPrice, baseFeePerGas)
	if priorityFeePerGas.Sign() < 0 {
		priorityFeePerGas.SetInt64(0)
	}
	priorityFee := new(big.Int).Mul(gasUsed, priorityFeePerGas)
	totalGasFee := new(big.Int).Mul(gasUsed, effectiveGasPrice)
	net := new(big.Int).Sub(gross, totalGasFee)

	return &txProfit{
		TxHash:               txHash,
		BotAddress:           bot,
		ProfitToken:          token,
		GrossRevenueWei:      gross,
		BaseFeeCostWei:       baseFeeCost,
		PriorityFeeWei:       priorityFee,
		TotalGasFeeWei:       totalGasFee,
		NetProfitWei:         net,
		MarginPercent:        percentString(net, gross, 6),
		GasUsed:              gasUsed,
		EffectiveGasPriceWei: effectiveGasPrice,
		BaseFeePerGasWei:     baseFeePerGas,
	}, nil
}

func analyzeTxFile(ctx context.Context, client *rpcClient, path string, profitToken string) (*aggregate, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	hashes, err := readHashes(file)
	if err != nil {
		return nil, err
	}
	if len(hashes) == 0 {
		return nil, fmt.Errorf("no transaction hashes found in %s", path)
	}

	sum := &aggregate{
		GrossRevenue:   new(big.Int),
		NetProfit:      new(big.Int),
		BaseFeeCost:    new(big.Int),
		PriorityFee:    new(big.Int),
		TotalGasFee:    new(big.Int),
		ProfitToken:    normalizeAddress(profitToken),
		AnalyzedTxFile: path,
	}

	for _, hash := range hashes {
		profit, err := analyzeTx(ctx, client, hash, profitToken)
		if err != nil {
			sum.SkippedTxs = append(sum.SkippedTxs, fmt.Sprintf("%s (%v)", hash, err))
			continue
		}
		if sum.FirstBotSeen == "" {
			sum.FirstBotSeen = profit.BotAddress
		}
		sum.Count++
		sum.GrossRevenue.Add(sum.GrossRevenue, profit.GrossRevenueWei)
		sum.NetProfit.Add(sum.NetProfit, profit.NetProfitWei)
		sum.BaseFeeCost.Add(sum.BaseFeeCost, profit.BaseFeeCostWei)
		sum.PriorityFee.Add(sum.PriorityFee, profit.PriorityFeeWei)
		sum.TotalGasFee.Add(sum.TotalGasFee, profit.TotalGasFeeWei)
	}
	if sum.Count == 0 {
		return sum, errors.New("all transactions failed analysis")
	}
	return sum, nil
}

func readHashes(r io.Reader) ([]string, error) {
	scanner := bufio.NewScanner(r)
	re := regexp.MustCompile(`0x[0-9a-fA-F]{64}`)
	seen := make(map[string]bool)
	var hashes []string
	for scanner.Scan() {
		for _, match := range re.FindAllString(scanner.Text(), -1) {
			hash := strings.ToLower(match)
			if !seen[hash] {
				seen[hash] = true
				hashes = append(hashes, hash)
			}
		}
	}
	return hashes, scanner.Err()
}

func parseHexBig(value string) (*big.Int, error) {
	value = strings.TrimPrefix(strings.TrimSpace(value), "0x")
	if value == "" {
		return big.NewInt(0), nil
	}
	n := new(big.Int)
	if _, ok := n.SetString(value, 16); !ok {
		return nil, fmt.Errorf("invalid hex integer %q", value)
	}
	return n, nil
}

func topicAddress(topic string) (string, error) {
	topic = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(topic)), "0x")
	if len(topic) != 64 {
		return "", fmt.Errorf("invalid indexed address topic length: %s", topic)
	}
	return "0x" + topic[24:], nil
}

func normalizeAddress(addr string) string {
	addr = strings.TrimSpace(strings.ToLower(addr))
	if !strings.HasPrefix(addr, "0x") {
		addr = "0x" + addr
	}
	return addr
}

func percentString(numerator *big.Int, denominator *big.Int, decimals int) string {
	if denominator.Sign() == 0 {
		return "NaN"
	}
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals+2)), nil)
	scaled := new(big.Int).Mul(numerator, scale)
	scaled.Quo(scaled, denominator)

	sign := ""
	if scaled.Sign() < 0 {
		sign = "-"
		scaled.Abs(scaled)
	}

	base := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	whole := new(big.Int).Quo(scaled, base)
	fraction := new(big.Int).Mod(scaled, base)
	return fmt.Sprintf("%s%s.%s", sign, whole.String(), leftPadZeros(fraction.String(), decimals))
}

func leftPadZeros(value string, width int) string {
	if len(value) >= width {
		return value
	}
	return strings.Repeat("0", width-len(value)) + value
}

func printTxProfit(p *txProfit) {
	fmt.Printf("tx: %s\n", p.TxHash)
	fmt.Printf("bot: %s\n", p.BotAddress)
	fmt.Printf("profitToken: %s\n", p.ProfitToken)
	fmt.Printf("grossRevenueWei: %s\n", p.GrossRevenueWei)
	fmt.Printf("baseFeeCostWei: %s\n", p.BaseFeeCostWei)
	fmt.Printf("priorityFeeWei: %s\n", p.PriorityFeeWei)
	fmt.Printf("totalGasFeeWei: %s\n", p.TotalGasFeeWei)
	fmt.Printf("netProfitWei: %s\n", p.NetProfitWei)
	fmt.Printf("marginPercent: %s\n", p.MarginPercent)
	fmt.Printf("gasUsed: %s\n", p.GasUsed)
	fmt.Printf("effectiveGasPriceWei: %s\n", p.EffectiveGasPriceWei)
	fmt.Printf("baseFeePerGasWei: %s\n", p.BaseFeePerGasWei)
}

func printAggregate(a *aggregate) {
	fmt.Printf("txFile: %s\n", a.AnalyzedTxFile)
	fmt.Printf("botFirstSeen: %s\n", a.FirstBotSeen)
	fmt.Printf("profitToken: %s\n", a.ProfitToken)
	fmt.Printf("analyzedCount: %d\n", a.Count)
	fmt.Printf("totalGrossRevenueWei: %s\n", a.GrossRevenue)
	fmt.Printf("totalBaseFeeCostWei: %s\n", a.BaseFeeCost)
	fmt.Printf("totalPriorityFeeWei: %s\n", a.PriorityFee)
	fmt.Printf("totalGasFeeWei: %s\n", a.TotalGasFee)
	fmt.Printf("totalNetProfitWei: %s\n", a.NetProfit)
	fmt.Printf("aggregateMarginPercent: %s\n", percentString(a.NetProfit, a.GrossRevenue, 6))
	if len(a.SkippedTxs) > 0 {
		fmt.Printf("skippedCount: %d\n", len(a.SkippedTxs))
		for _, skipped := range a.SkippedTxs {
			fmt.Printf("skipped: %s\n", skipped)
		}
	}
}

func main() {
	rpcURL := flag.String("rpc", os.Getenv("RPC_URL"), "Ethereum JSON-RPC URL; defaults to RPC_URL")
	txHash := flag.String("tx", "", "single transaction hash to analyze")
	txFile := flag.String("tx-file", "", "file or CSV containing transaction hashes to aggregate")
	profitToken := flag.String("profit-token", defaultProfitToken, "ERC-20 token used to measure profit")
	flag.Parse()

	if *rpcURL == "" {
		fmt.Fprintln(os.Stderr, "missing -rpc or RPC_URL")
		os.Exit(2)
	}
	if (*txHash == "" && *txFile == "") || (*txHash != "" && *txFile != "") {
		fmt.Fprintln(os.Stderr, "provide exactly one of -tx or -tx-file")
		os.Exit(2)
	}

	ctx := context.Background()
	client := newRPCClient(*rpcURL)

	if *txHash != "" {
		profit, err := analyzeTx(ctx, client, strings.ToLower(*txHash), *profitToken)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		printTxProfit(profit)
		return
	}

	sum, err := analyzeTxFile(ctx, client, *txFile, *profitToken)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	printAggregate(sum)
}
