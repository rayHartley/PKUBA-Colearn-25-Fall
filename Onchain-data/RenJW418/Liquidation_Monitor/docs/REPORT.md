# Liquidation Monitor 报告

## 项目概述

本项目实现了一个 Morpho Blue 清算事件监控工具，基于 HyperEVM 的 kHYPE/WHYPE market 起步，完成单笔交易解析、实时监控、历史回测，并扩展到单链全 market 与多链监控。核心目标是产出可直接推送 Telegram 的清算收益摘要，帮助快速判断清算价值与收益结构。

## 任务完成情况

- Step 1：Morpho Blue 协议与 market 参数已记录在配置与链配置中。
- Step 2：清算交易解析已在 digest 中实现，并在下文详细说明。
- Step 3：Gross revenue 使用清算区块的 oracle 价格。
- Step 4：Bribe cost 与 net profit 基于 EIP-1559 费用字段计算。
- Step 5：Digest 函数与 Telegram bot 已实现。
- Step 6：回测支持历史 logs 拉取、去重、排序与分块请求。
- 思考题：本报告与 analysis_thinking_question.py 中已回答。
- Challenge 1：monitor-all 支持单链全 market 监听。
- Challenge 2：monitor-all --all-chains 支持多链监听。

## Step 1：理解 Morpho 协议

### 关键发现

- Morpho Blue 采用单一合约架构（singleton），所有 market 共用合约地址，通过 marketId 区分。
- HyperEVM Morpho 合约地址位于链配置中；marketId 由 5 个参数 keccak256 得到。
- 关键参数包括 loanToken、collateralToken、oracle 与 lltv。

### Oracle 说明

Morpho oracle 的 `price()` 返回值以 10^36 为缩放，且价格含义是“1 单位 collateral 用 loan 计价”。因此计算 gross revenue 时不应直接拼接外部 feed，而应调用 oracle 合约的 `price()` 方法。

## Step 2：清算交易解析

### 事件与资金流

清算事件由 Morpho 合约的 Liquidate 事件触发，核心字段为 `repaidAssets` 与 `seizedAssets`。资金流逻辑：

1) 清算人偿还 loan 资产（repaidAssets）。
2) 清算人获得 collateral 资产（seizedAssets）。
3) 清算人通常通过 DEX 将 collateral 换回 loan 资产并实现收益。

digest 逻辑中直接使用 Liquidate 事件的字段，并结合 market 参数动态获取 token decimals 与符号。

## Step 3：Gross Revenue

借款资产计价的 gross revenue：

```
gross = seizedAssets * oraclePrice / 1e36 - repaidAssets
```

关键注意事项：

- 必须在清算所在区块查询 `oracle.price()`，确保价格与交易一致。
- `price()` 已考虑 token decimals 与内部缩放，不应手动拼接 feed。

## Step 4：Bribe 与 Net Profit

费用拆分遵循 EIP-1559：

- base fee cost = baseFeePerGas * gasUsed
- bribe cost（priority fee）= (effectiveGasPrice - baseFeePerGas) * gasUsed
- net profit = gross - base fee cost - bribe cost
- margin = net / gross

这样既能表达交易的真实成本，也能区分“竞争清算权”的额外成本。

## Step 5：Digest 与 Telegram

`digest_tx(tx_hash, chain_id)` 负责输出人类可读摘要，包含：

- 交易与区块信息
- Market 与地址信息
- Repaid / Seized
- Oracle 价格与 gross revenue
- Gas cost、bribe cost、net profit 与 margin

Telegram 推送实现带 1 msg/sec 的 rate limit，避免清算高频时丢消息。

## Step 6：测试与验证

回测采用 `eth_getLogs` 分块拉取，按 `(blockNumber, transactionIndex, logIndex)` 排序后去重 tx，再批量调用 digest。这样可以验证：

- 是否覆盖目标区间内的所有清算
- 输出数值范围是否合理

## 思考题

为什么 oracle-based gross revenue 往往高于真实收益、且清算规模越大偏差越明显？

### 1) 价格冲击与滑点

Oracle 价格是参考价，真实收益需要在 AMM/DEX 中成交。大额 swap 会消耗池内流动性，成交均价低于参考价，偏差随规模扩大。

### 2) DEX 手续费

AMM 会收取手续费，这部分归 LP，直接降低清算人可实现收益。

### 3) 流动性深度限制

清算规模越大，跨越的流动性区间越多，滑点非线性增大，导致 oracle 估算与真实收益差距进一步拉大。

### 4) 难以通用复原

不同清算人策略差异大（直接 swap / 聚合器路由 / 持有不换），因此无法用单一通用方法从链上 transfer 复原“真实收益”。oracle 估算虽然偏高，但一致、可复用。

## Challenge 1：单链全市场

实现方式：

- 监听时不使用 market id 作为 topic filter，仅保留合约地址与 Liquidate 事件签名。
- 这样可以捕获该链上所有 Morpho Blue market 的清算事件。

验证思路：

- 回测时不指定 marketId，抽样检查多个 market 的日志是否可正确解析。
- digest 动态读取 token decimals，避免非 18 位 token 解析错误。

## Challenge 2：多链扩展

实现方式：

- 在链配置中维护各链 chain id、RPC 与 Morpho 合约地址。
- 多链模式并发启动每条链监听任务，并统一走 digest 输出。

可用命令：

- `liquidation-sentinel monitor-all --all-chains`

## 已知限制与改进方向

- 公共 RPC 对 `eth_getLogs` 速率限制明显，适合加重试与指数退避。
- 若需要更完整历史统计，可接入 Morpho GraphQL 或链浏览器 API。
