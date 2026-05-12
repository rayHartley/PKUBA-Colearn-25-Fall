# Project Report

## Overview

本项目实现 PKUBA 第三次大作业 `Liquidation Monitor`，目标是围绕 HyperEVM 上 Morpho Blue 的 `kHYPE / WHYPE` market，完成：

- 单笔清算分析
- 实时监控
- Telegram 推送
- 历史回放验证

## Target

- Chain: HyperEVM
- Morpho Blue: `0x68e37dE8d93d3496ae143F2E900490f6280C57cD`
- Market ID: `0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc`
- Loan Token: WHYPE
- Collateral Token: kHYPE

## Implementation

项目使用 Go 构建，核心命令包括：

- `digest`：分析单笔清算交易
- `monitor`：持续监控 liquidation 事件
- `backfill`：按区块范围回放历史 liquidation
- `verify-official`：和 Morpho 官方历史记录做覆盖对照

核心逻辑包括：

1. 从交易回执中解析 Morpho `Liquidate` 事件
2. 调用 `idToMarketParams` 获取 market 参数
3. 调用 oracle `price()` 获取交易所在 block 的价格
4. 调用 ERC20 `decimals()` 做数值换算
5. 计算 `gross revenue`、`gas cost`、`priority fee bribe`、`net profit`
6. 输出适合 Telegram 推送的 digest

## Revenue Logic

使用 oracle-based 估算：

```text
collateral_value_in_loan = seizedAssets * oraclePrice / 1e36
gross_revenue = collateral_value_in_loan - repaidAssets
net_profit = gross_revenue - gas_cost - bribe_cost
```

这里的 `net profit` 展示默认采用 `WHYPE ~= HYPE` 的近似，仅适用于本次目标 market。

## Monitoring Strategy

- 若配置了可用的 `HYPER_RPC_WSS`，优先使用 websocket subscribe
- 若未配置或连接失败，则自动回退到 polling

这样既兼容题目对实时监控的要求，也适配 Hyperliquid 公共 RPC 当前对 websocket JSON-RPC 的限制。

## Verification Result

已经完成以下验证：

- `go build ./...` 通过
- `go test ./...` 通过
- 示例交易 `0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b` digest 跑通
- Telegram 消息实发成功
- 官方历史覆盖对照结果：

```text
Official count: 59
On-chain count: 59
Missing on-chain: 0
Extra on-chain: 0
Coverage matches official Morpho history.
```

## Usage

```bash
cp .env.example .env
go run ./cmd/liquidation-monitor digest --tx <tx_hash>
go run ./cmd/liquidation-monitor monitor
go run ./cmd/liquidation-monitor backfill --from-block 33170000 --to-block 33171000
go run ./cmd/liquidation-monitor verify-official
```
