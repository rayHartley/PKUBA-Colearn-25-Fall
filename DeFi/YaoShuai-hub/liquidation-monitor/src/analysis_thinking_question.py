"""
思考题分析：为什么 Oracle-based Gross Revenue 比真实值大？

以示例 tx 0xd0914ffc... 为例：
- Oracle-based Gross Revenue: 0.908518 HYPE
- 真实 Gross Revenue: 0.853386 HYPE
- Oracle 高估: 6.46%

=== 原因分析 ===

Oracle price 反映的是 kHYPE/WHYPE 的"公允市场价格"（由 RedStone 预言机提供）。
但清算人获取 kHYPE 后，必须通过 DEX swap 才能 realize 利润。

Swap 过程中产生的损耗:

1. Price Impact / Slippage（价格冲击）
   - 大额 swap 会消耗 AMM pool 的流动性，推动价格
   - 实际成交均价低于 oracle 报价
   - 清算规模越大 → 消耗的流动性越多 → price impact 越大
   → 这就是为什么"清算规模越大时，oracle 高估现象越明显"

2. DEX 手续费
   - Uniswap V3 style pool 收取 swap fee（如 0.05%~1%）
   - Fee 被 LP 拿走，减少了清算人的实际收入

3. 流动性深度
   - Pool TVL 有限时，大额 swap 需要跨越多个 tick
   - 可能需要拆分到多个 pool / 路由

=== 本例 Token Flow ===

清算人 (0x7250f8...) 的操作:
1. 向 Morpho 偿还 20.3805 WHYPE（repaidAssets）
2. 从 Morpho 获得 20.9238 kHYPE（seizedAssets）
3. 将 20.9238 kHYPE 送入 DEX swap
4. swap 结果: 获得 20.3805 WHYPE（归还 flash loan）+ 0.8534 WHYPE（纯利润）

Oracle 理论计算:
- collateral value = 20.9238 × 1.01745 = 21.289 WHYPE
- gross revenue = 21.289 - 20.381 = 0.909 WHYPE

实际 swap 结果:
- 有效汇率 = 21.234 / 20.924 ≈ 1.01483 < 1.01745 (oracle)
- 真实 gross revenue = 0.8534 WHYPE

差异来源:
- swap slippage + fee ≈ 0.055 HYPE (占 oracle revenue 的 ~6%)

=== 为什么这种方法不 general ===

不同 liquidation bot 的行为不同:
- 有的直接 AMM swap
- 有的用聚合器（1inch, Paraswap）寻找最优路由
- 有的使用 flash loan + callback 原子化操作
- 有的甚至持有 collateral 不立即 swap

所以从 token transfer 中 extract "真实收入" 的方法因 bot 而异，
无法写出一个通用的解析器。而 oracle-based 估算虽然有偏差，但是通用的。
"""

if __name__ == "__main__":
    # 验证真实 gross revenue 的提取
    from web3 import Web3
    from src.config import HYPER_RPC_HTTP

    w3 = Web3(Web3.HTTPProvider(HYPER_RPC_HTTP))
    tx_hash = "0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b"
    receipt = w3.eth.get_transaction_receipt(tx_hash)

    # 本例中真实 gross revenue 可以从 token transfer 中提取:
    # 清算人通过 swap 得到的 WHYPE 利润 = Log#10 中的 0.8533856899 WHYPE
    # (这是 pool 输出给 router 的第二笔 WHYPE，即扣除还 flash loan 后的净利润)
    transfer_topic = "ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    whype_addr = "0x5555555555555555555555555555555555555555"

    real_gross_revenue = None
    for log in receipt.logs:
        if (
            log.address.lower() == whype_addr.lower()
            and log.topics
            and log.topics[0].hex() == transfer_topic
        ):
            amount = int(log.data.hex(), 16)
            # The 0.8534 WHYPE transfer is the real profit
            if 0.5e18 < amount < 1.5e18:
                real_gross_revenue = amount / 1e18
                break

    if real_gross_revenue:
        print(f"Real Gross Revenue extracted: {real_gross_revenue:.12f} HYPE")
        print(f"Expected: 0.853385689941153325 HYPE")
        print(f"Match: {abs(real_gross_revenue - 0.853385689941) < 0.0001}")
