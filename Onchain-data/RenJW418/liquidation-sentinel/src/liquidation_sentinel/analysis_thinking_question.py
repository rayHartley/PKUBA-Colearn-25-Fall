def explain_oracle_vs_realized() -> str:
    return (
        "基于 oracle 的 gross revenue 使用公允参考价，但真实执行包含交易成本。"
        "清算人需要把抵押资产在 AMM/DEX 中兑换为借款资产，价格冲击与手续费会降低实际成交价。"
        "清算规模越大，swap 穿越的流动性区间越多，滑点呈非线性放大，"
        "因此 oracle 估算与真实收益的偏差会更明显。"
    )


if __name__ == "__main__":
    print(explain_oracle_vs_realized())
