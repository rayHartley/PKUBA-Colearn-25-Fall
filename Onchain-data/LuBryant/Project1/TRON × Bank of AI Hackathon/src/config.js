import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

loadEnvFile(path.join(rootDir, '.env'));

const defaultWatchlist = [
  { label: 'WINkLink Contract', address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7' },
  { label: 'USDT Contract', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' },
  { label: 'USDD Contract', address: 'TPYmHEhy5n8TCEfYGqW2rPxsghSfzghPDn' },
  { label: 'SUN Contract', address: 'TSSMHYeV2uE9qYH95DqyoCuNCzEL1NvU3S' },
  { label: 'JUST Contract', address: 'TCFLL5dx5ZJdKnWuesXxi1VPwjLVmWZZy9' }
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function toNumber(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeBaseUrl(baseUrl, port) {
  if (!baseUrl) {
    return `http://localhost:${port}`;
  }

  return baseUrl.replace(/\/+$/u, '');
}

function normalizeOptionalBaseUrl(baseUrl) {
  if (!baseUrl) {
    return '';
  }

  return baseUrl.replace(/\/+$/u, '');
}

function resolveX402Mode() {
  if (process.env.X402_MODE) {
    return process.env.X402_MODE;
  }

  if (process.env.X402_FACILITATOR_URL || process.env.X402_FACILITATOR_API_KEY) {
    return 'facilitator';
  }

  return 'demo';
}

function resolveFacilitatorUrl(mode) {
  if (process.env.X402_FACILITATOR_URL) {
    return normalizeOptionalBaseUrl(process.env.X402_FACILITATOR_URL);
  }

  if (mode === 'facilitator') {
    return 'https://facilitator.bankofai.io';
  }

  return '';
}

function parseWatchlist(raw) {
  if (!raw) {
    return defaultWatchlist;
  }

  const entries = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const [label, address] = item.split('|').map((part) => part.trim());
      if (!label || !address) {
        return null;
      }

      return { label, address };
    })
    .filter(Boolean);

  return entries.length > 0 ? entries : defaultWatchlist;
}

const configuredWatchlist = parseWatchlist(process.env.DEFAULT_WATCHLIST);
const port = toNumber(process.env.PORT, 3000);
const x402Mode = resolveX402Mode();

export const config = {
  appName: 'TRON Whale Radar',
  rootDir,
  publicDir,
  port,
  publicBaseUrl: normalizeBaseUrl(process.env.PUBLIC_BASE_URL, port),
  tronGridBaseUrl: 'https://api.trongrid.io',
  tronGridApiKey: process.env.TRONGRID_API_KEY || '',
  tronscanApiBaseUrl: 'https://apilist.tronscanapi.com',
  requestTimeoutMs: toNumber(process.env.REQUEST_TIMEOUT_MS, 12000),
  overviewCacheTtlMs: toNumber(process.env.OVERVIEW_CACHE_TTL_MS, 180000),
  hotWalletsCacheTtlMs: toNumber(process.env.HOT_WALLETS_CACHE_TTL_MS, 180000),
  defaultWatchlist: configuredWatchlist,
  hotWalletSeedLimit: toNumber(process.env.HOT_WALLET_SEED_LIMIT, configuredWatchlist.length),
  hotWalletMaxRows: toNumber(process.env.HOT_WALLET_MAX_ROWS, 6),
  llm: {
    baseUrl: normalizeOptionalBaseUrl(process.env.LLM_BASE_URL || ''),
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'gpt-4.1-mini'
  },
  x402: {
    mode: x402Mode,
    network: process.env.X402_NETWORK || 'tron-nile',
    asset: process.env.X402_ASSET || 'USDT',
    assetAddress: process.env.X402_ASSET_ADDRESS || '',
    assetDecimals: toNumber(process.env.X402_ASSET_DECIMALS, 6),
    payTo: process.env.X402_PAY_TO || '',
    priceAtomic: process.env.X402_PRICE_ATOMIC || '1000000',
    demoToken: process.env.X402_DEMO_TOKEN || 'demo-paid',
    realm: process.env.X402_REALM || 'TRON Whale Radar Premium',
    facilitatorUrl: resolveFacilitatorUrl(x402Mode),
    facilitatorApiKey: process.env.X402_FACILITATOR_API_KEY || ''
  }
};
