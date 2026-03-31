import { analyzeWalletActivity } from './analysis.js';
import { formatCompactNumber, formatDateTime, normalizeLanguage, isChinese } from './lang.js';
import { buildSampleTransfers, fallbackHotWallets, fallbackMarketOverview } from '../sample-data.js';

const WHALE_UNIT_THRESHOLDS = {
  USDT: 100000,
  TRX: 500000
};

const DAY_MS = 24 * 60 * 60 * 1000;

export async function fetchWalletActivity(address, config) {
  const diagnostics = [];
  const transfers = [];

  try {
    const usdtTransfers = await fetchUsdtTransfers(address, config);
    transfers.push(...usdtTransfers);
  } catch (error) {
    diagnostics.push(`USDT activity fallback: ${error.message}`);
  }

  try {
    const trxTransfers = await fetchTrxTransfers(address, config);
    transfers.push(...trxTransfers);
  } catch (error) {
    diagnostics.push(`TRX activity fallback: ${error.message}`);
  }

  if (transfers.length === 0 && diagnostics.length > 0) {
    return {
      transfers: buildSampleTransfers(address),
      degraded: true,
      diagnostics,
      source: ['sample']
    };
  }

  return {
    transfers: transfers.sort((left, right) => right.timestamp - left.timestamp),
    degraded: diagnostics.length > 0,
    diagnostics,
    source: ['TronGrid', 'TRONSCAN']
  };
}

export async function fetchHotWallets(config, language = 'en') {
  const lang = normalizeLanguage(language);
  const [overviewResult, leaderboardResult] = await Promise.allSettled([
    fetchTop10Overview(config, lang),
    buildCounterpartyLeaderboard(config, lang)
  ]);

  const diagnostics = [];
  let wallets = localizeFallbackHotWallets(lang);
  let leaderboard = buildFallbackLeaderboardMeta(config, wallets.length, lang);
  let source = ['sample'];
  let degraded = false;

  if (overviewResult.status === 'rejected') {
    diagnostics.push(`TRONSCAN overview fallback: ${overviewResult.reason.message}`);
  }

  if (leaderboardResult.status === 'fulfilled' && leaderboardResult.value.wallets.length > 0) {
    wallets = leaderboardResult.value.wallets;
    leaderboard = leaderboardResult.value.leaderboard;
    source = leaderboardResult.value.source;
    degraded = leaderboardResult.value.degraded;
    diagnostics.push(...leaderboardResult.value.diagnostics);
  } else {
    degraded = true;
    diagnostics.push(
      leaderboardResult.status === 'rejected'
        ? `Counterparty leaderboard fallback: ${leaderboardResult.reason.message}`
        : lang === 'zh-CN'
          ? '没有拿到可用的实时对手方排名，页面已切回演示榜单。'
          : 'No live counterparties were ranked, so the app switched to demo leaderboard rows.'
    );
  }

  return {
    marketOverview:
      overviewResult.status === 'fulfilled' ? overviewResult.value : localizeMarketOverview(fallbackMarketOverview, lang),
    wallets,
    leaderboard,
    degraded: degraded || diagnostics.length > 0,
    diagnostics,
    source
  };
}

export function buildCounterpartyLeaderboardRows(seedAnalyses, config, referenceTime = Date.now(), language = 'en') {
  const lang = normalizeLanguage(language);
  const aggregate = new Map();
  const labelLookup = new Map(config.defaultWatchlist.map((item) => [item.address, item.label]));
  const now = typeof referenceTime === 'number' ? referenceTime : new Date(referenceTime).getTime();

  for (const item of seedAnalyses) {
    const counterparties = item.analysis.counterpartyStats || item.analysis.counterparties || [];

    for (const counterparty of counterparties) {
      mergeCounterpartyAggregate(aggregate, counterparty, item.seed);
    }
  }

  return [...aggregate.values()]
    .map((entry) => finalizeLeaderboardEntry(entry, labelLookup, now, lang))
    .sort(compareLeaderboardEntries)
    .slice(0, Math.max(1, config.hotWalletMaxRows || 6))
    .map((wallet, index) => ({
      ...wallet,
      rank: index + 1
    }));
}

async function fetchUsdtTransfers(address, config) {
  const url = new URL(`/v1/accounts/${address}/transactions/trc20`, config.tronGridBaseUrl);
  url.searchParams.set('only_confirmed', 'true');
  url.searchParams.set('limit', '40');
  url.searchParams.set('contract_address', 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t');

  const payload = await fetchJson(url, {
    timeoutMs: config.requestTimeoutMs,
    headers: config.tronGridApiKey ? { 'TRON-PRO-API-KEY': config.tronGridApiKey } : {}
  });

  const rows = Array.isArray(payload?.data) ? payload.data : [];
  return rows.map((item) => normalizeTrc20Transfer(item, address)).filter(Boolean);
}

async function fetchTrxTransfers(address, config) {
  const url = new URL('/api/transfer/trx', config.tronscanApiBaseUrl);
  url.searchParams.set('address', address);
  url.searchParams.set('limit', '40');
  url.searchParams.set('start', '0');
  url.searchParams.set('reverse', 'true');
  url.searchParams.set('db_version', '1');

  const payload = await fetchJson(url, { timeoutMs: config.requestTimeoutMs });
  const rows = extractRows(payload);

  return rows.map((item) => normalizeTrxTransfer(item, address)).filter(Boolean);
}

async function fetchTop10Overview(config, language) {
  const zh = isChinese(language);
  const url = new URL('/api/top10', config.tronscanApiBaseUrl);
  url.searchParams.set('type', '0');
  url.searchParams.set('time', '2');

  const payload = await fetchJson(url, { timeoutMs: config.requestTimeoutMs });
  const data = payload?.data && !Array.isArray(payload.data) ? payload.data : payload;

  return {
    timeframe: '24h',
    totalTransferValue: pickValue(data, ['trxTransferAmount', 'transferAmount', 'totalTransferAmount']) || 'N/A',
    totalTransactions: toNumber(pickValue(data, ['transactionCount', 'transactions', 'txCount'])),
    activeAddresses: toNumber(pickValue(data, ['activeAddress', 'activeAddresses', 'addressCount'])),
    note: zh ? '来自 TRONSCAN 的实时市场概览' : 'Live TRONSCAN overview'
  };
}

function normalizeTrc20Transfer(item, targetAddress) {
  const from = item.from || item.transferFromAddress || '';
  const to = item.to || item.transferToAddress || '';
  const decimals = Number(item.token_info?.decimals || item.tokenDecimal || 6);
  const amount = toDecimalAmount(item.value || item.amount || '0', decimals);
  const direction = to === targetAddress ? 'in' : from === targetAddress ? 'out' : null;
  const counterparty = direction === 'in' ? from : to;

  if (!direction || !counterparty) {
    return null;
  }

  return {
    hash: item.transaction_id || item.transactionHash || item.hash || `usdt-${item.block_timestamp}`,
    token: item.token_info?.symbol || 'USDT',
    tokenType: 'TRC20',
    source: 'TronGrid',
    timestamp: Number(item.block_timestamp || item.timestamp || Date.now()),
    from,
    to,
    counterparty,
    direction,
    amount
  };
}

function normalizeTrxTransfer(item, targetAddress) {
  const from = item.transferFromAddress || item.fromAddress || item.ownerAddress || '';
  const to = item.transferToAddress || item.toAddress || item.to || '';
  const amountRaw = item.amount || item.quant || item.value || '0';
  const decimals = Number(item.tokenInfo?.tokenDecimal || item.decimals || 6);
  const amount = toDecimalAmount(amountRaw, decimals);
  const direction = to === targetAddress ? 'in' : from === targetAddress ? 'out' : null;
  const counterparty = direction === 'in' ? from : to;

  if (!direction || !counterparty) {
    return null;
  }

  return {
    hash: item.transactionHash || item.hash || `trx-${item.timestamp}`,
    token: 'TRX',
    tokenType: 'native',
    source: 'TRONSCAN',
    timestamp: Number(item.timestamp || item.block_ts || Date.now()),
    from,
    to,
    counterparty,
    direction,
    amount
  };
}

async function buildCounterpartyLeaderboard(config, language) {
  const zh = isChinese(language);
  const diagnostics = [];
  const sourceSet = new Set();
  const seedAnalyses = [];
  const requestedSeedCount = Math.max(1, config.hotWalletSeedLimit || config.defaultWatchlist.length);
  const seeds = config.defaultWatchlist.slice(0, Math.min(requestedSeedCount, config.defaultWatchlist.length));

  for (const seed of seeds) {
    try {
      const activity = await fetchWalletActivity(seed.address, config);

      if (activity.source.includes('sample')) {
        diagnostics.push(
          zh
            ? `${seed.label}：实时数据不可用，因此这个种子地址没有被纳入真实榜单。`
            : `${seed.label}: live activity was unavailable, so this seed was excluded from the real leaderboard.`
        );
        continue;
      }

      for (const source of activity.source) {
        sourceSet.add(source);
      }

      if (activity.degraded) {
        diagnostics.push(...activity.diagnostics.map((item) => `${seed.label}: ${item}`));
      }

      seedAnalyses.push({
        seed,
        analysis: analyzeWalletActivity(seed.address, activity.transfers, Date.now(), language)
      });
    } catch (error) {
      diagnostics.push(`${seed.label}: ${error.message}`);
    }
  }

  const wallets = buildCounterpartyLeaderboardRows(seedAnalyses, config, Date.now(), language);
  const fallbackMeta = buildFallbackLeaderboardMeta(config, wallets.length, language);

  if (wallets.length === 0) {
    diagnostics.push(
      zh
        ? '当前没能从监控地址中聚合出任何实时对手方。'
        : 'The app could not aggregate any live counterparties from the tracked public watchlist.'
    );
  }

  return {
    wallets,
    leaderboard: {
      ...fallbackMeta,
      description:
        wallets.length > 0
          ? zh
            ? `基于 ${seedAnalyses.length}/${seeds.length} 个公开监控地址的真实对手方排名，统一分数同时考虑交互次数、跨 watchlist 覆盖度、鲸鱼级资金量和最近活跃度。`
            : `Real counterparties ranked across ${seedAnalyses.length}/${seeds.length} tracked public wallets using one score that blends interaction count, cross-watchlist coverage, whale-sized volume, and recency.`
          : fallbackMeta.description,
      liveSeedCount: seedAnalyses.length,
      configuredSeedCount: seeds.length,
      seeds: seedAnalyses.map((item) => item.seed.label)
    },
    degraded: seedAnalyses.length === 0 || seedAnalyses.length < seeds.length || diagnostics.length > 0,
    diagnostics,
    source: sourceSet.size > 0 ? ['aggregated-watchlist-ranking', ...sourceSet] : ['aggregated-watchlist-ranking']
  };
}

async function fetchJson(url, options = {}) {
  const attempts = options.retries ?? 2;
  let lastError;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await wait(350 * (attempt + 1));
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError;
}

function mergeCounterpartyAggregate(aggregate, counterparty, seed) {
  const current = aggregate.get(counterparty.address) || {
    address: counterparty.address,
    interactions: 0,
    inbound: {},
    outbound: {},
    latestActivityAt: 0,
    seedLabels: new Set()
  };

  current.interactions += counterparty.interactions || 0;
  current.latestActivityAt = Math.max(current.latestActivityAt, toTimestamp(counterparty.latestActivityAt));
  current.seedLabels.add(seed.label);
  mergeTokenMaps(current.inbound, counterparty.inbound);
  mergeTokenMaps(current.outbound, counterparty.outbound);

  aggregate.set(counterparty.address, current);
}

function finalizeLeaderboardEntry(entry, labelLookup, now, language) {
  const whaleUnits = calculateWhaleUnits(entry.inbound) + calculateWhaleUnits(entry.outbound);
  const direction = getCounterpartyDirection(entry);
  const latestActivityAt = entry.latestActivityAt ? new Date(entry.latestActivityAt).toISOString() : null;
  const score = calculateLeaderboardScore(entry, whaleUnits, now);
  const seedLabels = [...entry.seedLabels];

  return {
    label: labelLookup.get(entry.address) || `Wallet ${shortenAddress(entry.address)}`,
    address: entry.address,
    direction,
    metricValue: `${score}/100`,
    metricLabel: isChinese(language) ? '7 天 Whale Radar 评分' : '7d whale radar score',
    supportingMetric: isChinese(language)
      ? `${entry.interactions} 笔交互，覆盖 ${seedLabels.length} 个监控钱包`
      : `${entry.interactions} tx across ${seedLabels.length} tracked wallet${seedLabels.length === 1 ? '' : 's'}`,
    transactionCount: entry.interactions,
    seedCount: seedLabels.length,
    seedLabels,
    latestActivityAt,
    profile: classifyLeaderboardProfile(direction, seedLabels.length, whaleUnits, language),
    insight: buildLeaderboardInsight(entry, seedLabels, latestActivityAt, language),
    score
  };
}

function calculateLeaderboardScore(entry, whaleUnits, now) {
  const interactionScore = Math.min(entry.interactions * 7, 36);
  const coverageScore = Math.min(entry.seedLabels.size * 16, 28);
  const volumeScore = Math.min(Math.round(whaleUnits * 12), 26);
  const recencyScore = calculateRecencyScore(entry.latestActivityAt, now);
  return Math.min(100, interactionScore + coverageScore + volumeScore + recencyScore);
}

function calculateRecencyScore(latestActivityAt, now) {
  if (!latestActivityAt) {
    return 0;
  }

  if (latestActivityAt >= now - DAY_MS) {
    return 10;
  }

  if (latestActivityAt >= now - 3 * DAY_MS) {
    return 6;
  }

  if (latestActivityAt >= now - 7 * DAY_MS) {
    return 3;
  }

  return 0;
}

function classifyLeaderboardProfile(direction, seedCount, whaleUnits, language) {
  const zh = isChinese(language);

  if (seedCount >= 3) {
    return zh ? '跨 watchlist 枢纽地址' : 'Cross-watchlist hub';
  }

  if (direction === 'inflow' && whaleUnits >= 2.5) {
    return zh ? '高价值发送方' : 'High-value sender';
  }

  if (direction === 'outflow' && whaleUnits >= 2.5) {
    return zh ? '高价值接收方' : 'High-value receiver';
  }

  if (direction === 'mixed' && whaleUnits >= 1.2) {
    return zh ? '路由型对手方' : 'Routing counterparty';
  }

  return zh ? '活跃对手方' : 'Active counterparty';
}

function compareLeaderboardEntries(left, right) {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.seedCount !== left.seedCount) {
    return right.seedCount - left.seedCount;
  }

  if (right.transactionCount !== left.transactionCount) {
    return right.transactionCount - left.transactionCount;
  }

  return toTimestamp(right.latestActivityAt) - toTimestamp(left.latestActivityAt);
}

function buildLeaderboardInsight(entry, seedLabels, latestActivityAt, language) {
  const zh = isChinese(language);
  const seedSummary = summarizeSeedLabels(seedLabels, language);
  const flowSummary = describeCounterpartyFlow(entry, language);
  const parts = [
    zh
      ? `它出现在 ${seedLabels.length} 个监控钱包里：${seedSummary}。`
      : `Observed across ${seedLabels.length} tracked wallets: ${seedSummary}.`,
    flowSummary
  ];

  if (latestActivityAt) {
    parts.push(
      zh
        ? `最近活动时间：${formatDateTime(latestActivityAt, language)}。`
        : `Last activity: ${formatDateTime(latestActivityAt, language)}.`
    );
  }

  return parts.join(' ');
}

function summarizeSeedLabels(seedLabels, language) {
  if (seedLabels.length <= 2) {
    return seedLabels.join(', ');
  }

  return isChinese(language)
    ? `${seedLabels.slice(0, 2).join('、')} 等 ${seedLabels.length} 个监控地址`
    : `${seedLabels.slice(0, 2).join(', ')} +${seedLabels.length - 2} more`;
}

function buildFallbackLeaderboardMeta(config, rankedWalletCount, language) {
  const zh = isChinese(language);
  const requestedSeedCount = Math.max(1, config.hotWalletSeedLimit || config.defaultWatchlist.length);
  const configuredSeedCount = Math.min(requestedSeedCount, config.defaultWatchlist.length);

  return {
    metricLabel: zh ? '7 天 Whale Radar 评分' : '7d whale radar score',
    window: '7d',
    rankedWalletCount,
    liveSeedCount: 0,
    configuredSeedCount,
    description: zh
      ? '榜单应基于统一评分对公开监控钱包的真实对手方进行排序。当实时数据不可用时，界面会回退到演示榜单。'
      : 'Counterparties should be ranked by one shared score across tracked public wallets. When live data is unavailable, the UI falls back to demo rows.',
    methodology: zh
      ? '评分综合考虑交互次数、触达的监控钱包数量、鲸鱼级资金量和最近活跃度。'
      : 'Score blends interaction count, number of tracked wallets touched, whale-sized volume, and recency.'
  };
}

function extractRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.token_transfers)) {
    return payload.token_transfers;
  }
  if (Array.isArray(payload?.list)) {
    return payload.list;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
}

function toDecimalAmount(rawValue, decimals) {
  if (rawValue === undefined || rawValue === null) {
    return 0;
  }

  const negative = String(rawValue).startsWith('-');
  const digits = String(rawValue).replace(/[^\d]/gu, '') || '0';
  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = padded.slice(-decimals).slice(0, 4);
  return Number(`${negative ? '-' : ''}${whole}.${fraction}`);
}

function pickValue(data, candidates) {
  for (const key of candidates) {
    if (data && data[key] !== undefined && data[key] !== null) {
      return data[key];
    }
  }
  return null;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getCounterpartyDirection(counterparty) {
  const inbound = calculateWhaleUnits(counterparty.inbound);
  const outbound = calculateWhaleUnits(counterparty.outbound);

  if (inbound === 0 && outbound === 0) {
    return 'mixed';
  }

  if (inbound >= outbound * 1.2) {
    return 'inflow';
  }

  if (outbound >= inbound * 1.2) {
    return 'outflow';
  }

  return 'mixed';
}

function calculateWhaleUnits(tokenMap) {
  return Object.entries(tokenMap || {}).reduce(
    (sum, [token, amount]) => sum + normalizeTokenAmount(token, amount),
    0
  );
}

function normalizeTokenAmount(token, amount) {
  const threshold = WHALE_UNIT_THRESHOLDS[token];
  if (threshold) {
    return amount / threshold;
  }

  return amount > 0 ? 0.25 : 0;
}

function describeCounterpartyFlow(counterparty, language) {
  const zh = isChinese(language);
  const inbound = describeTokenMap(counterparty.inbound, zh ? '流入监控集合' : 'Into the tracked set', language);
  const outbound = describeTokenMap(counterparty.outbound, zh ? '从监控集合流出' : 'Out from the tracked set', language);

  if (inbound && outbound) {
    return zh
      ? `共 ${counterparty.interactions} 次交互。${inbound}；${outbound}。`
      : `${counterparty.interactions} interactions. ${inbound}; ${outbound}.`;
  }

  if (inbound) {
    return zh
      ? `共 ${counterparty.interactions} 次交互。${inbound}。`
      : `${counterparty.interactions} interactions. ${inbound}.`;
  }

  if (outbound) {
    return zh
      ? `共 ${counterparty.interactions} 次交互。${outbound}。`
      : `${counterparty.interactions} interactions. ${outbound}.`;
  }

  return zh
    ? `共 ${counterparty.interactions} 次交互，但当前没有可展示的代币拆分。`
    : `${counterparty.interactions} interactions with no token breakdown available.`;
}

function describeTokenMap(tokenMap, prefix, language) {
  const entries = Object.entries(tokenMap || {})
    .filter(([, amount]) => amount > 0)
    .map(([token, amount]) => `${formatCompactNumber(amount, language, 1)} ${token}`);

  if (entries.length === 0) {
    return '';
  }

  return `${prefix}: ${entries.join(' / ')}`;
}

function mergeTokenMaps(target, source) {
  for (const [token, amount] of Object.entries(source || {})) {
    target[token] = round((target[token] || 0) + amount);
  }
}

function localizeMarketOverview(overview, language) {
  return {
    ...overview,
    note: isChinese(language)
      ? '由于实时 TRONSCAN 市场数据暂时不可用，当前展示的是回退快照。'
      : overview.note
  };
}

function localizeFallbackHotWallets(language) {
  if (!isChinese(language)) {
    return fallbackHotWallets;
  }

  return fallbackHotWallets.map((wallet) => ({
    ...wallet,
    label:
      wallet.label === 'Demo Inflow Case'
        ? '演示净流入样例'
        : wallet.label === 'Demo Outflow Case'
          ? '演示净流出样例'
          : wallet.label === 'Demo Routing Case'
            ? '演示路由样例'
            : wallet.label,
    metricLabel: '7 天 Whale Radar 评分',
    supportingMetric:
      wallet.label === 'Demo Inflow Case'
        ? '18 笔交互，覆盖 2 个监控钱包'
        : wallet.label === 'Demo Outflow Case'
          ? '27 笔交互，覆盖 1 个监控钱包'
          : '11 笔交互，覆盖 2 个监控钱包',
    profile: '演示榜单行',
    insight:
      wallet.label === 'Demo Inflow Case'
        ? '重复出现的大额 USDT 流入说明这个钱包可能正在吸收新的资金。'
        : wallet.label === 'Demo Outflow Case'
          ? '这个钱包在短时间内把 TRX 分发给多个对手方，更像一个分发节点。'
          : '资金流一进一出较为均衡，更像一个路由型钱包。'
  }));
}

function round(value) {
  return Number(value.toFixed(4));
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (typeof value === 'number') {
    return value;
  }

  return Date.parse(value) || 0;
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
