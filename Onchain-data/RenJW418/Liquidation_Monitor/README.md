# Liquidation Sentinel

HyperEVM 上的 Morpho Blue 清算事件监控器，包含交易摘要分析、Telegram 推送与历史回测。

## 目录导航

- [项目说明](docs/README.md)
- [项目报告](docs/REPORT.md)
- [命令行入口](src/liquidation_sentinel/cli.py)

## 提交内容

- src/ 代码
- docs/ 文档与报告
- .env.example 配置模板
- pyproject.toml 依赖定义

## 快速运行

```
python -m venv .venv
source .venv/bin/activate
pip install -e .

cp .env.example .env

liquidation-sentinel digest 0xd0914ffca28b8770dd0282c2ac53fbda8fc3abad26401ee60637e980caeae61b
liquidation-sentinel monitor
liquidation-sentinel monitor-all
liquidation-sentinel backtest --from-block 33170000 --to-block 33171000
```

## 常用命令

- 单笔分析：`liquidation-sentinel digest <tx_hash>`
- 单市场监控：`liquidation-sentinel monitor`
- 全市场监控：`liquidation-sentinel monitor-all`
- 多链监控：`liquidation-sentinel monitor-all --all-chains`
- 历史回测：`liquidation-sentinel backtest --from-block X --to-block Y`

## 说明

- `.env` 已被 `.gitignore` 忽略，不会提交到仓库。
- 未配置 Telegram 时，消息输出到 stdout。
