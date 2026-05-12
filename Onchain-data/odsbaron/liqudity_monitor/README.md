# Liqudity Monitor

这是整理后的项目提交目录，包含代码、配置模板和文档说明。

## 目录导航

- [项目简介](./docs/README.md)
- [项目报告](./docs/REPORT.md)
- [命令行入口](./cmd/liquidation-monitor/main.go)

## 提交内容

- `cmd/` 命令行入口代码
- `internal/` 核心实现代码
- `docs/` 项目文档说明
- `.env.example` 配置模板
- `go.mod` / `go.sum` 依赖定义

## 快速运行

```bash
cp .env.example .env
go run ./cmd/liquidation-monitor digest --tx <tx_hash>
```

## 常用命令

```bash
go run ./cmd/liquidation-monitor digest --tx <tx_hash>
go run ./cmd/liquidation-monitor monitor
go run ./cmd/liquidation-monitor backfill --from-block 33170000 --to-block 33171000
go run ./cmd/liquidation-monitor verify-official
```

## 说明

- `.env` 已被 `.gitignore` 忽略，不会被提交。
- 若未配置可用的 `HYPER_RPC_WSS`，监控会自动回退到 polling。
