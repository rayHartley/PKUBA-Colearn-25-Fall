# Project 2 - Atomic Arbitrage Reproduction

This workspace contains two deliverables for `01-intro-to-atomic-arb.md`.

## Reproduce the arbitrage

The reproduced route is:

```text
WETH -> EMP -> pEMP -> pfWETH -> WETH
```

The first hop is the same shape as the original transaction: a Uniswap V3
exact-output swap for EMP, paid with WETH in the callback. The Peapods calls use
the real traced signatures `bond(address,uint256,uint256)` and
`redeem(uint256,address,address)`.

Run the fork test with an Ethereum archive RPC:

```bash
$env:RPC_URL="https://your-archive-rpc.example"
forge test --match-test test_arb -vvvv
```

The test forks immediately before transaction
`0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730`,
executes the four-hop path, and checks:

```text
amountIn        = 562611020353505727
amountOut       = 569640303749166945
gross profit    =   7029283395661218
```

The on-chain WETH transfer logs are one wei lower than the numbers printed in
the markdown reference answer, so the test uses the log-derived values.
The test intentionally does not call `vm.warp`; pfWETH accrues time-based
interest, so advancing the timestamp changes the final wei-level output.
The test reads `RPC_URL` first and falls back to `INFURA_URL`, matching the
provided `.env` layout.

## Challenge: bot revenue stats

The Go CLI computes gross revenue, gas costs, priority fee, net profit, and
margin from RPC data and ERC-20 `Transfer` logs.

Single tx:

```bash
$env:RPC_URL="https://ethereum.publicnode.com"
go run ./cmd/mevprofit -tx 0x9edea0b66aece76f0bc7e185f9ce5cac81ce41bdd1ec4d3cf1907274bc8aa730
```

Monthly aggregation:

```bash
go run ./cmd/mevprofit -tx-file data/eigenphi-bot-YYYY-MM.csv
```

The file may be a plain text list or a CSV exported from EigenPhi; every
`0x...` transaction hash in the file is deduplicated and analyzed.
