# Morpho Blue Liquidation Monitor

HyperEVM 上 Morpho Blue 协议清算事件监控 Bot（PKUBA 区块链协会共学项目）。

## 任务完成情况

| Step | 内容 | 状态 |
|------|------|------|
| Step 1 | 理解 Morpho 协议 | ✅ |
| Step 2 | 分析清算交易 (token flow) | ✅ |
| Step 3 | 计算 Gross Revenue (oracle price) | ✅ |
| Step 4 | Bribe Cost 和 Net Profit | ✅ |
| Step 5 | 封装 Digest 函数 + 搭建 TG Bot | ✅ |
| Step 6 | 历史数据批量测试验证 | ✅ |
| 思考题 | Oracle vs 真实 revenue 差异分析 | ✅ |
| Challenge 1 | 拓展到 HyperEVM 所有 markets | ✅ |
| Challenge 2 | 拓展到所有 Morpho 部署链 | ✅ |

---

## 快速开始

```bash
# 初始化环境
uv sync

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的 Telegram Bot Token 和 Chat ID

# 分析单笔清算交易
uv run digest 0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b

# 启动实时监控（单 market: kHYPE/WHYPE）
uv run monitor

# 启动全 market 监控（Challenge 1）
uv run monitor-all

# 启动多链监控（Challenge 2）
uv run monitor-all --all-chains

# 历史数据回测
uv run backtest --from-block 33170000 --to-block 33171000
```

---

## 项目结构

```
src/
├── config.py                    # 配置（RPC、合约地址、Market ID）
├── abi.py                       # Morpho Blue 合约 ABI 和事件定义
├── oracle.py                    # Oracle 价格查询 & gross revenue 计算
├── digest.py                    # 清算交易完整分析 & digest 生成
├── telegram_bot.py              # Telegram Bot 推送（含 rate limit）
├── monitor.py                   # 实时监听（WSS 订阅 / HTTP polling）
├── monitor_all.py               # Challenge: 全 market + 多链监控
├── chains.py                    # Challenge: 多链配置
├── backtest.py                  # 历史事件批量回测
├── cli.py                       # CLI 入口
└── analysis_thinking_question.py # 思考题详细分析
tests/
└── test_oracle.py               # 单元测试
```

---

## Step 详细说明

### Step 1: 理解 Morpho 协议

**关键发现：**
- Morpho Blue 在 HyperEVM 上的合约地址: `0x68e37dE8d93d3496ae143F2E900490f6280C57cD`
- kHYPE/WHYPE market ID: `0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc`
- Market 参数:
  - loanToken (WHYPE): `0x5555555555555555555555555555555555555555`
  - collateralToken (kHYPE): `0xfD739d4e423301CE9385c1fb8850539D657C296D`
  - oracle: `0x3cD172D59A71D0e4AD41C76dab1fa2Bf8dee97Cb`
  - LLTV: 86%

### Step 2: 分析清算交易

示例 tx: `0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b`

**Token Flow 解析：**
```
清算人 (0x7250f8...) 的操作:
1. 向 Morpho 偿还 20.3805 WHYPE (repaidAssets)
2. 从 Morpho 获得 20.9238 kHYPE (seizedAssets)  
3. 将 20.9238 kHYPE 通过 DEX swap 变现
4. Swap 结果: 获得 20.3805 WHYPE (还 flash loan) + 0.8534 WHYPE (利润)
```

### Step 3: 计算 Gross Revenue

**Oracle 结构分析：**
- Oracle 类型: MorphoChainlinkOracleV2
- BASE_FEED_1: `0xFfe5F5e9e18b88FBdD7e28d4A583a111C874fB47` (RedStone kHYPE_FUNDAMENTAL)
- SCALE_FACTOR: 10^28
- Feed decimals: 8
- 价格计算: `price = latestAnswer × SCALE_FACTOR = 101745380 × 10^28 = 1.0174538 × 10^36`

**Gross Revenue 公式:**
```
collateral_value_in_loan = seizedAssets × oracle_price / 10^36
gross_revenue = collateral_value_in_loan - repaidAssets
```

**示例结果:** 0.908518 HYPE

### Step 4: Bribe Cost 和 Net Profit

**HyperEVM Bribe 机制：**
- HyperEVM 没有 Flashbots/MEV-Boost 的 builder-proposer 架构
- Bribe 通过 **priority fee** 实现（本例: 0.150683 HYPE）
- 没有向第三方固定比例转账

**计算结果（示例 tx）：**
| 指标 | 值 |
|------|-----|
| Gross Revenue (oracle) | 0.908518 HYPE |
| Gas Cost (base fee) | 0.000042 HYPE |
| Bribe (priority fee) | 0.150683 HYPE |
| **Net Profit** | **0.757793 HYPE** |
| **Margin** | **83.41%** |

### Step 5: Digest 函数 + Telegram Bot

- `digest_tx(tx_hash, chain_id)` → 格式化消息字符串
- Telegram Bot 推送，含 rate limit 控制（1 msg/sec）
- 支持消息分片（>4096 字符自动拆分）

### Step 6: 测试与验证

- `uv run backtest --from-block X --to-block Y` 拉取历史清算事件
- 自动去重、排序、逐条 digest
- 结果同步推送到 Telegram
- HyperEVM RPC 限制: 每次最多查 1000 blocks，已内置 chunk + retry 逻辑

---

## 思考题

**Q: 为什么 Oracle-based Gross Revenue 总比真实值大？清算规模越大越明显？**

**A:** Oracle price 是 "公允市场价格"，但清算人需通过 DEX swap 才能 realize 利润。

| 因素 | 说明 |
|------|------|
| Price Impact | 大额 swap 消耗 AMM 流动性，推动价格下滑 |
| DEX 手续费 | swap fee 被 LP 拿走 |
| 流动性深度 | 大额清算可能需跨越多个 tick |

**本例验证：**
- Oracle 汇率: 1 kHYPE = 1.01745 WHYPE
- 实际 swap 有效汇率: 1 kHYPE ≈ 1.01483 WHYPE
- Oracle 高估: 6.46%

**为什么不 general：** 不同 bot 行为不同（直接 AMM swap / 聚合器路由 / 持有不 swap），无法写出通用的 "真实收入" 解析器。

详细分析见 `src/analysis_thinking_question.py`

---

## Challenge

### Challenge 1: 全 Market 监控

`src/monitor_all.py` 移除了 market_id 的 topic filter，只保留:
- 合约地址 filter (Morpho Blue singleton)
- 事件签名 filter (Liquidate)

这样可以捕获该链上所有 Morpho market 的清算事件。

```bash
uv run monitor-all            # HyperEVM 所有 markets
uv run monitor-all --chain 1  # Ethereum 主网所有 markets
```

### Challenge 2: 多链支持

`src/chains.py` 定义了所有已知的 Morpho Blue 部署:

| Chain | Chain ID | Morpho 地址 |
|-------|----------|-------------|
| HyperEVM | 999 | `0x68e37dE8d93d3496ae143F2E900490f6280C57cD` |
| Ethereum | 1 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Base | 8453 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |

```bash
uv run monitor-all --all-chains  # 同时监控所有链
```

多链模式使用 `asyncio.gather` 并发运行所有链的 monitor。

---

## 配置

复制 `.env.example` 为 `.env`，填入:

```bash
TG_BOT_TOKEN=your_bot_token    # @BotFather 创建
TG_CHAT_ID=your_chat_id        # 向 bot 发消息后用 getUpdates 获取
```
