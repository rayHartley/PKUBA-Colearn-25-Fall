## Liquidation Monitor

### 你能学到什么

1. 如何看懂一笔清算交易，理解清算的完整机制与参与方
2. Morpho 借贷协议的架构、核心概念与合约事件
3. 如何通过 oracle price 计算 loan 和 collateral 的价值，估算清算的 gross revenue
4. 如何识别 bribe cost 并计算 net profit
5. 对链上事件的实时监听，tg bot 的搭建与消息推送
7. 如何用历史事件数据批量测试 monitor bot

### 任务要求

搭建一个监控 Morpho 清算事件的 Telegram bot，实时播报每笔清算的收益摘要。

以 HyperEVM 上的单个 market [kHYPE / WHYPE](https://app.morpho.org/hyperevm/market/0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc/khype-whype) 为起点，分三个阶段完成：
1. **单笔 tx 分析**：看懂清算事件，封装 digest 函数
2. **实时监控**：订阅事件，接入 Telegram bot
3. **测试验证**：用历史数据批量对照

---

### Instructions

#### Step 1：理解 Morpho 协议

**Morpho Blue 是什么？**

Morpho Blue 是一个**无需许可的借贷协议**（permissionless lending）。任何人都可以创建一个独立的 market，并指定以下五个参数：

- `loanToken`：出借的 token（本 market 中为 WHYPE）
- `collateralToken`：用于抵押的 token（本 market 中为 kHYPE）
- `oracle`：价格预言机，用于评估抵押品价值
- `irm`：利率模型合约
- `lltv`：清算阈值（Liquidation Loan-to-Value），借款价值 / 抵押品价值超过此值即触发清算

与 Compound、Aave 不同，Morpho 整个协议只有**一个核心合约**（singleton 架构），所有 market 共用同一个合约，以 `marketId`（五个参数的哈希）来区分。

> **背景：** 本 market 的抵押品 kHYPE 是 HyperEVM 原生 token HYPE 的流动质押版本（类似以太坊上的 stETH），WHYPE 是 HYPE 的 wrapped 版本（类似 WETH）。HyperEVM 上的 gas fee 也以 HYPE 计价。

**清算是如何发生的？**

当借款人的抵押率（collateral value / borrow value）跌破 `1/lltv` 时，任何人都可以调用 `liquidate()` 成为清算人：
- 清算人偿还借款人的部分 loan token
- 换取借款人**超过实际价值**的 collateral token（即清算折扣）
- 这个折扣就是清算人的利润来源

**Liquidate 事件：**

每次清算都会 emit：

```solidity
event Liquidate(
    bytes32 indexed id,        // market ID
    address indexed caller,    // 清算人地址
    address indexed borrower,  // 被清算的借款人地址
    uint256 repaidAssets,      // 清算人偿还的 loan token 数量
    uint256 repaidShares,
    uint256 seizedAssets,      // 清算人获得的 collateral token 数量
    uint256 badDebtAssets,
    uint256 badDebtShares
);
```

最需要关注的是 `repaidAssets`（偿还的 loan）和 `seizedAssets`（获得的 collateral）。

**学习资源：**
- [Morpho 官方文档](https://docs.morpho.org/)
- [Morpho Blue GitHub](https://github.com/morpho-org/morpho-blue)

---

#### Step 2：分析清算交易

**示例 tx：**
[`0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b`](https://hyperevmscan.io/tx/0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b)

结合 token flow graph （你可以用 sentio, blocksec 等进阶区块链浏览器查看）和 event logs，理解清算交易的执行过程和各步骤的细节

---

#### Step 3：计算 Gross Revenue

**Gross Revenue（基于 oracle price 的估算）：**

清算人支出 loan token、获得 collateral token，两者的价值差就是毛利润：

```
gross revenue = seizedAssets × collateral price − repaidAssets × loan price
```

价格来自 market 对应的 **oracle 合约**。通过 Morpho 合约查询 market 参数拿到 oracle 地址，然后获取价格。

注意：
- 用 `eth_call` 在**该 tx 所在 block** 的状态下查询，确保价格与清算时一致
- 注意 decimals 的换算
- 注意理解 morpho oracle 各个接口的具体含义，`price` 到底代表什么？`BASE_FEED_1`, `BASE_FEED_2` 是什么？到底应该用哪一个价格计算？
- 可以用 HYPE 结算（币本位），可以用 usd 结算（u本位）

#### Step 4：Bribe Cost 和 Net Profit
找出 tx 是否有 bribe cost:
1. 网络是否有类似以太坊主网的 flashbots （builder-proposer） 架构
2. 是否有 priority fee（tx fee 显著高出普通 tx）
3. 是否有固定向某个第三方转账一定比例的 revenue
- 本例子中 bribe 是以 priority fee 的形式给出

gross revenue 减去 bribe cost 和 gas cost，得到 net profit。计算收益率（net profit / gross revenue）

---

#### Step 5：封装 Digest 函数
跟据 gross revenue, cost, net profit, margin 格式化生成 human-readable digest（适合 tg 消息的形式）

将上述流程封装为一个函数，输入 tx hash 和 chainId，输出可直接发送到 Telegram 的消息字符串：

---

#### Step 5：搭建监控 Bot

**整体架构：**

```
HyperEVM RPC (wss://) ──subscribe──▶ event listener
                                           │
                                      Digest(txHash)
                                           │
                                     Telegram Bot API ──▶ chat
```

1. rpc subscribe to morpho 的 liquidation event log 的 hash
2. 每当听到新的 liquidation event，调用上面的封装函数生成 digest
3. tg bot 将 digest 报告到 chat 中
	- 注意考虑 tg bot 的 rate limit，否则短时间输出太多会漏掉

---

#### Step 6：测试与验证

等待实时清算触发效率太低——用历史数据批量测试是更快的验证方式。

**拉取历史 Liquidate 事件：**

用 `eth_getLogs` 拉取指定 market 在某段区块范围内的所有清算事件：

将 tx hash 去重、按 block number, tx index 升序排序，喂给 monitor bot，观察 bot 在 Telegram chat 中的输出。

**对照目标：**

Morpho 官方 app 提供了该 market 的清算历史列表：

[kHYPE/WHYPE — Advanced](https://app.morpho.org/hyperevm/market/0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc/khype-whype#advanced)

对照 app 中的清算记录，验证你的 bot 是否覆盖了所有清算事件，收益数值是否在合理范围内。

---

### 思考题
通过 oracle price 计算 loan 和 collateral 价值，再作差获得 gross revenue，得到的 revenue 往往比真实的 revenue 大，尤其是清算规模越大时，这个现象越明显，为什么？
- 例如 example tx 中的真实 gross revenue 是：`0.853385689941153325 HYPE`
- 对于该例子，真实 gross revenue 能比较容易地 extract 出来。然而不同的 liquidation bot 行为不同，realize revenue 的形式也不同，所以这种方法并不 general

---

### Challenge
1. 将 monitor 的对象从 [kHYPE / WHYPE](https://app.morpho.org/hyperevm/market/0x64e7db7f042812d4335947a7cdf6af1093d29478aff5f1ccd93cc67f8aadfddc/khype-whype) 单 market 拓展到 HyperEVM 的所有 markets
2. 进一步拓展到所有有 morpho 部署的链