# Liquidation Sentinel

HyperEVM 上的 Morpho Blue 清算事件监控器，包含交易摘要分析、Telegram 推送与历史回测。

## 任务完成情况

| 事项 | 状态 |
| --- | --- |
| Step 1 | 理解 Morpho 协议 | ✅ |
| Step 2 | 分析清算交易 (token flow) | ✅ |
| Step 3 | 计算 Gross Revenue (oracle price) | ✅ |
| Step 4 | Bribe Cost 和 Net Profit | ✅ |
| Step 5 | 封装 Digest 函数 + 搭建 TG Bot | ✅ |
| Step 6 | 历史数据批量测试验证 | ✅ |
| 思考题 | Oracle vs 真实 revenue 差异分析 | ✅ |
| Challenge 1 | 拓展到 HyperEVM 所有 markets | ✅ |
| Challenge 2 | 拓展到所有 Morpho 部署链 | ✅ |

## 快速开始

1) 创建虚拟环境并安装依赖。

```
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

2) 配置环境变量。

```
cp .env.example .env
```

3) 运行命令。

```
liquidation-sentinel digest 0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b

liquidation-sentinel monitor

liquidation-sentinel monitor-all

liquidation-sentinel monitor-all --all-chains

liquidation-sentinel backtest --from-block 33170000 --to-block 33171000
```

## 环境变量

HyperEVM 必填：

- HYPEREVM_HTTP_RPC
- HYPEREVM_WSS_RPC（可选，用于日志过滤轮询）

Telegram 推送可选：

- TG_BOT_TOKEN
- TG_CHAT_ID

多链挑战可选：

- ETHEREUM_HTTP_RPC
- ETHEREUM_WSS_RPC
- BASE_HTTP_RPC
- BASE_WSS_RPC

若未配置 Telegram，消息将输出到 stdout。

## 项目结构

```
src/
├── liquidation_sentinel/
│   ├── abi.py
│   ├── config.py
│   ├── chains.py
│   ├── oracle.py
│   ├── digest.py
│   ├── telegram_bot.py
│   ├── monitor.py
│   ├── monitor_all.py
│   ├── backtest.py
│   ├── cli.py
│   └── analysis_thinking_question.py
```

## 说明

- Gross revenue 使用 Morpho oracle 价格（1 个抵押资产以借贷资产计价，缩放 1e36）。
- Bribe 近似为 priority fee： (effectiveGasPrice - baseFeePerGas) * gasUsed。
- Net profit = gross revenue - gas cost - bribe cost。

## 运行结果

### 单笔 digest

```
Chain: HyperEVM (999)
Tx: 0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b
Block: 33170974
Market: 64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc
Borrower: 0xd3d7091ACe5518FafCfFf9E18b6F1D0A24Ec637a
Liquidator: 0x7250F80367c82452e843d292778b3dab346ad387
Repaid: 20.380528 WHYPE
Seized: 20.923846 kHYPE
Oracle price: 1.018001 WHYPE/kHYPE
Gross revenue: 0.919971 WHYPE
Gas cost: 0.000042 HYPE
Bribe cost: 0.150683 HYPE
Net profit: 0.769246 WHYPE
Margin: 83.62%
```

### 小区间 backtest

```
liquidation-sentinel backtest --from-block 33170970 --to-block 33170980

Chain: HyperEVM (999)
Tx: d0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b
Block: 33170974
Market: 64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc
Borrower: 0xd3d7091ACe5518FafCfFf9E18b6F1D0A24Ec637a
Liquidator: 0x7250F80367c82452e843d292778b3dab346ad387
Repaid: 20.380528 WHYPE
Seized: 20.923846 kHYPE
Oracle price: 1.018001 WHYPE/kHYPE
Gross revenue: 0.919971 WHYPE
Gas cost: 0.000042 HYPE
Bribe cost: 0.150683 HYPE
Net profit: 0.769246 WHYPE
Margin: 83.62%
```
