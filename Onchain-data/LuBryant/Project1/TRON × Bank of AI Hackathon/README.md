# TRON Whale Radar

TRON Whale Radar is a bilingual AI on-chain data agent built for the TRON and Bank of AI Hackathon.

It monitors whale-sized TRON wallet activity, turns raw transfers into readable AI-style intelligence, and monetizes premium wallet reports through Bank of AI `x402`.

This is not just a dashboard. It is a TRON-native AI agent with:

- live on-chain analysis
- wallet behavior classification
- whale alerts
- a real premium unlock flow
- Bank of AI seller readiness
- optional 8004 registration support

## What the project does

For any TRON address, the app can:

- fetch recent USDT and TRX activity
- compute 24h and 7d flow summaries
- detect whale-style movement and burst behavior
- classify wallets into patterns such as accumulation, distribution, routing, or treasury-like behavior
- generate a free readable overview
- lock a deeper premium intelligence brief behind `402 Payment Required`

The premium layer adds:

- a stronger wallet profile summary
- behavior hypotheses
- an evidence pack
- a monitoring playbook
- next watchpoints for follow-up analysis

## Why this fits the hackathon

- Uses TRON as the live data layer through TronGrid and TRONSCAN
- Uses Bank of AI as the monetization layer through `x402`
- Presents the project as an AI agent, not only a visualization tool
- Includes an optional `8004` path for discoverability and agent identity
- Is scoped tightly enough to demo reliably in a hackathon setting

## Current product shape

The app is a single-page web product plus JSON APIs.

The homepage includes:

- a bilingual language switcher at the top (`EN` / `中文`)
- a judge-facing "Why This Wins" section
- a Bank of AI readiness section
- a tracked wallet input flow
- a live counterparty ranking section
- a free wallet overview
- a premium insight section

The language switch affects:

- UI labels
- free overview text
- whale alerts
- ranking descriptions
- premium insight content

## Core features

### 1. Free wallet overview

For a valid TRON address, the free endpoint returns:

- headline
- summary
- observations
- whale alerts
- wallet profile
- activity score
- token-level net flow
- top counterparties
- recent transfers

### 2. Live counterparty ranking

The homepage ranking is no longer placeholder content.

It aggregates real counterparties across a tracked public watchlist and ranks them with one shared score based on:

- interaction count
- cross-watchlist coverage
- whale-sized volume
- recency

When live upstream APIs are unavailable, the app falls back to demo rows so the hackathon demo still works.

### 3. Premium intelligence behind Bank of AI x402

The premium endpoint:

- returns `402 Payment Required` before access
- exposes payment requirements
- supports demo unlock mode
- supports live facilitator mode through the official Bank of AI facilitator

In live mode, the server verifies and settles through the configured facilitator before returning premium data.

### 4. Bank of AI readiness

The app includes a dedicated readiness panel and health endpoint fields for:

- seller mode
- official facilitator detection
- facilitator API key presence
- seller wallet presence
- premium endpoint visibility
- agent card visibility

### 5. Optional 8004 path

The project exposes:

- `/agent-card.json`
- a local helper script for 8004 registration draft generation

This gives you a clean story for "discoverable, monetizable AI agent" if you want to extend the submission.

## Architecture

The project has 4 practical layers:

### Data layer

- `TronGrid` for wallet activity, especially TRC20 USDT transfers
- `TRONSCAN` for native TRX activity, market overview, and supplemental ranking context

### Analysis layer

Rule-based detection computes structured signals such as:

- whale-sized transfers
- mega transfers
- net accumulation vs distribution
- burst density
- counterparty concentration
- recent activity spike
- cross-asset whale behavior

### Insight layer

The app always produces deterministic template output.

If an OpenAI-compatible LLM endpoint is configured, it upgrades:

- free overview narrative
- premium profile summary
- hypotheses
- evidence framing
- monitoring playbook

This keeps demos stable even if the model layer fails.

### Monetization layer

Bank of AI `x402` protects the premium endpoint.

That means the agent is not only analyzing TRON data; it is also selling higher-value analysis as a service.

## Quick start

### Requirements

- Node.js 18+ recommended
- a `.env` file based on `.env.example`

### Install

```powershell
npm install
```

### Start the server

```powershell
node src/server.js
```

Or:

```powershell
npm run dev
```

Open:

```text
http://localhost:3000
```

## Environment variables

Start from `.env.example`.

### Minimum useful setup

```env
PORT=3000
PUBLIC_BASE_URL=http://localhost:3000
TRONGRID_API_KEY=your_trongrid_api_key
```

### Optional LLM setup

```env
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=your_llm_api_key
LLM_MODEL=gpt-4.1-mini
```

Any OpenAI-compatible endpoint can be used.

### Bank of AI demo mode

Default lightweight hackathon mode:

```env
X402_MODE=demo
X402_NETWORK=tron-nile
X402_ASSET=USDT
X402_ASSET_DECIMALS=6
X402_PRICE_ATOMIC=1000000
X402_DEMO_TOKEN=demo-paid
```

Behavior:

- premium returns a `402` challenge
- frontend can simulate unlock using `X-Demo-Payment`
- useful for fast demo recording

### Bank of AI facilitator mode

Real seller-side flow:

```env
X402_MODE=facilitator
X402_FACILITATOR_URL=https://facilitator.bankofai.io
X402_FACILITATOR_API_KEY=your_bankofai_api_key
X402_PAY_TO=your_tron_wallet
X402_NETWORK=tron-nile
X402_ASSET=USDT
X402_ASSET_DECIMALS=6
X402_PRICE_ATOMIC=1000000
```

Behavior:

- premium expects a valid `X-PAYMENT` header
- server calls facilitator `/verify`
- server calls facilitator `/settle`
- premium report is returned only after successful validation

## Health and readiness checks

### Health endpoint

```text
GET /api/health
```

Useful fields:

- `x402.mode`
- `x402.officialFacilitator`
- `bankOfAi.ready`
- `bankOfAi.hasApiKey`
- `bankOfAi.hasPayTo`
- `bankOfAi.premiumEndpoint`
- `bankOfAi.agentCardUrl`

Example:

```text
http://localhost:3000/api/health
http://localhost:3000/api/health?lang=zh-CN
```

### CLI readiness script

```powershell
node scripts/check-bankofai-ready.mjs
```

Or:

```powershell
npm run check:bankofai
```

This prints:

- mode
- ready / not ready
- official facilitator or not
- seller wallet presence
- API key presence
- premium endpoint URL
- agent card URL

## Buyer-side demo helper

This repo includes a small helper to print the challenge and optionally submit payment headers:

```powershell
node scripts/submit-x-payment.mjs http://localhost:3000 TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7
```

Or:

```powershell
npm run demo:buyer -- http://localhost:3000 TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7
```

If you do not provide `X_PAYMENT` or `X_DEMO_PAYMENT`, the script stops after printing the `402` challenge.

Example with demo mode:

```powershell
$env:X_DEMO_PAYMENT='demo-paid'
node scripts/submit-x-payment.mjs http://localhost:3000 TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7
```

Example with live payment:

```powershell
$env:X_PAYMENT='your_real_x_payment_payload'
node scripts/submit-x-payment.mjs http://localhost:3000 TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7
```

## API reference

### `GET /api/health`

Returns:

- service metadata
- watchlist
- x402 settings
- Bank of AI readiness status

### `GET /api/free/hot-wallets`

Returns:

- market overview
- live or fallback leaderboard rows
- ranking metadata
- diagnostics

Optional query params:

- `lang=en`
- `lang=zh-CN`
- `refresh=1`

### `GET /api/free/overview?address=...`

Returns:

- wallet headline
- free summary
- observations
- alerts
- behavior tags
- activity score
- token breakdown
- counterparties
- recent transfers

Optional query params:

- `lang=en`
- `lang=zh-CN`
- `refresh=1`

### `GET /api/premium/deep-dive?address=...`

Behavior:

- returns `402` until payment is accepted
- returns premium intelligence after success

Optional query params:

- `lang=en`
- `lang=zh-CN`
- `refresh=1`

### `GET /agent-card.json`

Returns a lightweight agent card describing:

- app identity
- endpoints
- x402 support
- Bank of AI metadata

## Suggested demo addresses

These are better framed as public, reproducible addresses than "personal whale wallets":

- `TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7` - WINkLink-related contract activity
- `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` - USDT contract
- `TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn` - USDD contract
- `TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S` - SUN contract
- `TMwFHYXLJaRUPeW6421aqXL4ZEzPRFGkGT` - USDJ contract

If you want the most stable first demo flow, start with:

```text
TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7
```

## Language support

The site supports:

- English
- Simplified Chinese

Switch using the top-right language toggle in the hero section.

The backend also supports language through query parameters:

- `?lang=en`
- `?lang=zh-CN`

This is useful for:

- bilingual demos
- recording separate English and Chinese walkthroughs
- testing API output directly

## Project structure

- `src/server.js` - HTTP server and API routes
- `src/config.js` - env loading and runtime config
- `src/services/analysis.js` - rule-based wallet analysis
- `src/services/insights.js` - free and premium narrative generation
- `src/services/tron-data.js` - TronGrid / TRONSCAN data access and leaderboard logic
- `src/services/x402.js` - Bank of AI and x402 gating logic
- `src/services/cache.js` - simple in-memory caching with stale fallback
- `public/index.html` - SPA shell
- `public/app.js` - frontend logic
- `public/i18n.js` - UI translation dictionary and language helpers
- `public/styles.css` - styling
- `scripts/check-bankofai-ready.mjs` - readiness CLI
- `scripts/submit-x-payment.mjs` - buyer-side demo helper
- `scripts/register-8004.mjs` - optional 8004 registration helper

## Tests

Run all tests:

```powershell
npm test
```

Or run them one by one:

```powershell
node tests/analysis.test.js
node tests/cache.test.js
node tests/insights.test.js
node tests/leaderboard.test.js
node tests/x402.test.js
```

## Demo flow for judges

The strongest 3 to 5 minute demo is:

1. Open the homepage and show "Why This Wins"
2. Open the Bank of AI readiness panel
3. Analyze a public TRON wallet
4. Refresh the live counterparty ranking
5. Trigger premium and show the `402` challenge
6. Unlock premium and show the deeper report

This tells a full story:

- TRON data
- AI interpretation
- monetization through Bank of AI
- optional 8004 expansion

## Known behavior and fallback design

This project is designed to survive unstable upstream conditions during a demo.

If TronGrid or TRONSCAN fail:

- diagnostics are shown
- the app marks the payload as degraded
- fallback sample activity is used where necessary

If the LLM layer fails:

- the app falls back to deterministic template output

This is intentional. Reliability matters more than perfect model output in a hackathon submission.

## Optional 8004 registration

The repo includes:

```powershell
node scripts/register-8004.mjs
```

To use it, configure:

- `PUBLIC_BASE_URL`
- `BOAI_8004_PRIVATE_KEY`
- optionally `BOAI_8004_RPC_URL`
- optionally `BOAI_8004_NETWORK`

The script generates a registration draft JSON and prints the final registration step.

## Deployment notes

- Runtime is lightweight
- Static frontend plus Node server is enough
- Works well for hackathon demo hosting
- Keep `/api/health`, `/api/free/overview`, `/api/free/hot-wallets`, and `/api/premium/deep-dive` public for judging

## References

- Hackathon brief: [TRON_BankOfAI_Hackathon.md](/d:/0-Document/University/PKU/Phd/Society/Blockchain/2026/TRON%20%C3%97%20Bank%20of%20AI%20Hackathon/TRON_BankOfAI_Hackathon.md)
- Bank of AI docs: https://docs.bankofai.io/zh-Hans/
- x402 seller quickstart: https://docs.bankofai.io/zh-Hans/x402/getting-started/quickstart-for-sellers/
- 8004 configure agents: https://docs.bankofai.io/8004/Usage/ConfigureAgents/
- 8004 registration: https://docs.bankofai.io/8004/Usage/RegistrationHTTP/
- TRON developer docs: https://developers.tron.network/docs/get-trc20-transaction-history
- TRONSCAN API docs: https://docs.tronscan.org/api-endpoints/transactions-and-transfers

## One-line summary

TRON Whale Radar turns raw TRON wallet activity into readable AI intelligence and sells premium insight through Bank of AI x402.
