# Odsbaron Liquidation Monitor

PKUBA 第三次大作业实现。项目使用 Go 监控 HyperEVM 上 Morpho Blue `kHYPE / WHYPE` market 的 `Liquidate` 事件，生成清算收益摘要，并支持 Telegram 推送。

更多实现说明见 `REPORT.md`。

## Features

- 单笔清算交易分析
- 历史清算回放
- 实时监控
- Telegram 推送
- 与 Morpho 官方历史记录做覆盖对照

## Quick Start

```bash
cp .env.example .env
go run ./cmd/liquidation-monitor digest --tx 0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b
```

## Commands

```bash
go run ./cmd/liquidation-monitor digest --tx <tx_hash>
go run ./cmd/liquidation-monitor monitor
go run ./cmd/liquidation-monitor backfill --from-block 33170000 --to-block 33171000
go run ./cmd/liquidation-monitor verify-official
```

## Environment

需要在 `.env` 中配置：

- `HYPER_RPC_HTTP`
- `HYPER_RPC_WSS`
- `TELEGRAM_TOKEN`
- `TELEGRAM_CHAT_ID`

其余参数默认已经指向本次作业的目标 market。

## Validation

当前版本已完成：

- `go build ./...`
- `go test ./...`
- 示例清算交易 digest 验证
- Telegram 实发测试
- 与 Morpho 官方 liquidation 历史对照验证

## Notes

- 当前默认只覆盖单 market。
- `WHYPE ~= HYPE` 的近似仅用于本作业场景下的净利润展示。
- 如果未提供可用的 `HYPER_RPC_WSS`，监控会自动回退到 polling。
