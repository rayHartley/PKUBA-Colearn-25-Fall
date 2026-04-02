import { formatCompactNumber, normalizeLanguage, isChinese } from './lang.js';

const LARGE_TRANSFER_THRESHOLDS = {
  USDT: 100000,
  TRX: 500000
};

const MEGA_TRANSFER_THRESHOLDS = {
  USDT: 500000,
  TRX: 2000000
};

const MATERIAL_NET_THRESHOLDS = {
  USDT: 250000,
  TRX: 1000000
};

const TRON_ADDRESS_REGEX = /^T[1-9A-HJ-NP-Za-km-z]{33}$/u;

export function isValidTronAddress(address) {
  return TRON_ADDRESS_REGEX.test(address || '');
}

export function analyzeWalletActivity(address, transfers, referenceTime = Date.now(), language = 'en') {
  const lang = normalizeLanguage(language);
  const now = typeof referenceTime === 'number' ? referenceTime : new Date(referenceTime).getTime();
  const sortedTransfers = [...transfers].sort((left, right) => right.timestamp - left.timestamp);
  const last24hTransfers = sortedTransfers.filter((item) => item.timestamp >= now - 24 * 60 * 60 * 1000);
  const last7dTransfers = sortedTransfers.filter((item) => item.timestamp >= now - 7 * 24 * 60 * 60 * 1000);
  const uniqueCounterparties = buildCounterpartyStats(last7dTransfers);

  const windows = {
    '24h': summarizeWindow(last24hTransfers),
    '7d': summarizeWindow(last7dTransfers)
  };

  const activitySpikeRatio =
    windows['7d'].count === 0 ? 0 : Number((windows['24h'].count / windows['7d'].count).toFixed(2));
  const whaleSignals = buildWhaleSignals(windows, activitySpikeRatio, uniqueCounterparties);
  const profile = classifyProfile(windows, uniqueCounterparties, whaleSignals, lang);
  const alerts = buildAlerts(windows, whaleSignals, uniqueCounterparties, lang);
  const tokenBreakdown = buildTokenBreakdown(last7dTransfers);

  return {
    address,
    language: lang,
    generatedAt: new Date(now).toISOString(),
    latestActivityAt: sortedTransfers[0] ? new Date(sortedTransfers[0].timestamp).toISOString() : null,
    activityScore: calculateActivityScore(windows['7d'], whaleSignals, alerts),
    whaleAlertLevel: deriveAlertLevel(alerts),
    whaleSignals,
    windows,
    tokenBreakdown,
    profile,
    alerts,
    behaviorTags: buildBehaviorTags(profile, alerts, whaleSignals, lang),
    counterpartyStats: uniqueCounterparties,
    counterparties: uniqueCounterparties.slice(0, 5),
    recentTransfers: sortedTransfers.slice(0, 12),
    transferCount: sortedTransfers.length
  };
}

function summarizeWindow(transfers) {
  const totals = {
    count: transfers.length,
    uniqueCounterparties: new Set(transfers.map((item) => item.counterparty)).size,
    totalIn: {},
    totalOut: {},
    net: {},
    largeTransfers: [],
    megaTransfers: [],
    largestInbound: null,
    largestOutbound: null,
    maxTransfersIn30m: 0
  };

  const byTimestamp = [...transfers].sort((left, right) => left.timestamp - right.timestamp);

  for (const transfer of transfers) {
    const bucket = transfer.direction === 'in' ? totals.totalIn : totals.totalOut;
    bucket[transfer.token] = round((bucket[transfer.token] || 0) + transfer.amount);

    if (!totals.net[transfer.token]) {
      totals.net[transfer.token] = 0;
    }

    totals.net[transfer.token] = round(
      totals.net[transfer.token] + (transfer.direction === 'in' ? transfer.amount : -transfer.amount)
    );

    const whaleThreshold = LARGE_TRANSFER_THRESHOLDS[transfer.token] || Number.POSITIVE_INFINITY;
    const megaThreshold = MEGA_TRANSFER_THRESHOLDS[transfer.token] || Number.POSITIVE_INFINITY;

    if (transfer.amount >= whaleThreshold) {
      totals.largeTransfers.push(transfer);
    }

    if (transfer.amount >= megaThreshold) {
      totals.megaTransfers.push(transfer);
    }

    if (transfer.direction === 'in') {
      if (!totals.largestInbound || transfer.amount > totals.largestInbound.amount) {
        totals.largestInbound = transfer;
      }
    } else if (!totals.largestOutbound || transfer.amount > totals.largestOutbound.amount) {
      totals.largestOutbound = transfer;
    }
  }

  let startIndex = 0;
  for (let endIndex = 0; endIndex < byTimestamp.length; endIndex += 1) {
    while (byTimestamp[endIndex].timestamp - byTimestamp[startIndex].timestamp > 30 * 60 * 1000) {
      startIndex += 1;
    }
    totals.maxTransfersIn30m = Math.max(totals.maxTransfersIn30m, endIndex - startIndex + 1);
  }

  return totals;
}

function buildCounterpartyStats(transfers) {
  const counterparties = new Map();
  const totalInteractions = transfers.length || 1;

  for (const transfer of transfers) {
    const current = counterparties.get(transfer.counterparty) || {
      address: transfer.counterparty,
      interactions: 0,
      inbound: {},
      outbound: {},
      latestActivityAt: transfer.timestamp
    };

    current.interactions += 1;
    current.latestActivityAt = Math.max(current.latestActivityAt, transfer.timestamp);

    const bucket = transfer.direction === 'in' ? current.inbound : current.outbound;
    bucket[transfer.token] = round((bucket[transfer.token] || 0) + transfer.amount);

    counterparties.set(transfer.counterparty, current);
  }

  return [...counterparties.values()]
    .map((entry) => ({
      ...entry,
      shareOfInteractions: round(entry.interactions / totalInteractions),
      latestActivityAt: new Date(entry.latestActivityAt).toISOString()
    }))
    .sort((left, right) => right.interactions - left.interactions);
}

function buildWhaleSignals(windows, activitySpikeRatio, counterparties) {
  const last24h = windows['24h'];
  const last7d = windows['7d'];
  const topCounterparty = counterparties[0] || null;
  const dominantToken = pickDominantToken(last7d.net, last7d.totalIn, last7d.totalOut);
  const netBias = classifyNetBias(last7d.net);
  const recentNetBias = classifyNetBias(last24h.net);

  return {
    activitySpikeRatio,
    dominantToken,
    netBias,
    recentNetBias,
    whaleTransferCount7d: last7d.largeTransfers.length,
    megaTransferCount7d: last7d.megaTransfers.length,
    whaleTransferCount24h: last24h.largeTransfers.length,
    megaTransferCount24h: last24h.megaTransfers.length,
    burstDensity24h: last24h.maxTransfersIn30m,
    uniqueCounterparties7d: last7d.uniqueCounterparties,
    topCounterpartyShare: topCounterparty?.shareOfInteractions || 0,
    topCounterpartyAddress: topCounterparty?.address || null,
    topCounterpartyInteractions: topCounterparty?.interactions || 0,
    materialNetTokens: listMaterialNetTokens(last7d.net),
    crossTokenWhale: touchesMultipleWhaleAssets(last7d.largeTransfers)
  };
}

function classifyProfile(windows, counterparties, signals, language) {
  const last24h = windows['24h'];
  const last7d = windows['7d'];
  const totalUsdtIn = last7d.totalIn.USDT || 0;
  const totalUsdtOut = last7d.totalOut.USDT || 0;
  const totalTrxIn = last7d.totalIn.TRX || 0;
  const totalTrxOut = last7d.totalOut.TRX || 0;

  if (
    signals.netBias === 'accumulation' &&
    (signals.whaleTransferCount7d >= 2 || totalUsdtIn >= MEGA_TRANSFER_THRESHOLDS.USDT)
  ) {
    return buildProfile(
      'accumulation_whale',
      'high',
      language,
      'Inbound stablecoin activity materially outweighs outbound movement and whale-sized deposits are stacking up.',
      '稳定币净流入明显强于流出，而且大额级别的转入在持续累积。'
    );
  }

  if (signals.netBias === 'distribution' && counterparties.length >= 4) {
    return buildProfile(
      'distribution_wallet',
      'medium',
      language,
      'Outbound movement dominates the observed window and funds are being pushed toward several receivers.',
      '观察窗口内的净流出占主导，而且资金被分散发送给多个接收方。'
    );
  }

  if (last24h.maxTransfersIn30m >= 4 && last24h.uniqueCounterparties >= 3) {
    return buildProfile(
      'routing_wallet',
      'medium',
      language,
      'Dense bursts across multiple counterparties suggest batching, sweeps, or routing behavior.',
      '短时间内对多个对手方出现密集转账，更像归集、分发或路由型操作。'
    );
  }

  if (signals.activitySpikeRatio >= 0.7 && last24h.count >= 4) {
    return buildProfile(
      'reactivated_treasury',
      'medium',
      language,
      'Most seven-day activity landed inside the last 24 hours, which often signals a wallet coming back online.',
      '过去 7 天的大部分活动都集中在最近 24 小时，像是一个重新活跃起来的钱包。'
    );
  }

  if (signals.topCounterpartyShare >= 0.45 && signals.topCounterpartyInteractions >= 4) {
    return buildProfile(
      'counterparty_hub_wallet',
      'medium',
      language,
      'One repeated counterparty dominates the recent flow, which points to an internal treasury cluster or operator hub.',
      '最近的交互高度集中在单一对手方上，可能属于同一资金集群或运营枢纽。'
    );
  }

  if (totalTrxIn + totalUsdtIn > totalTrxOut + totalUsdtOut) {
    return buildProfile(
      'active_treasury_like_wallet',
      'medium',
      language,
      'The wallet is active, net positive, and moving size, but not through a single clean behavioral pattern.',
      '这个钱包活跃、净流入为正、金额也足够大，但还没有呈现出单一清晰的行为模式。'
    );
  }

  return buildProfile(
    'two_way_active_wallet',
    'medium',
    language,
    'The wallet shows two-way flow with enough size to monitor, but without a dominant directional thesis yet.',
    '这个钱包有双向资金流，而且规模值得持续跟踪，但还没有形成明确的方向性判断。'
  );
}

function buildAlerts(windows, signals, counterparties, language) {
  const alerts = [];
  const last24h = windows['24h'];
  const last7d = windows['7d'];
  const topCounterparty = counterparties[0];
  const zh = isChinese(language);

  if (signals.megaTransferCount7d > 0) {
    alerts.push({
      type: 'mega_transfer',
      title: zh ? '超大额鲸鱼转账' : 'Mega Whale Transfer',
      severity: 'high',
      severityScore: 95,
      message: zh
        ? `最近 7 天内观测到 ${signals.megaTransferCount7d} 笔超大额转账。`
        : `${signals.megaTransferCount7d} mega-sized transfers were observed in the last 7 days.`,
      evidence: describeLargestTransfers(last7d.megaTransfers, language)
    });
  }

  if (signals.whaleTransferCount24h >= 2) {
    alerts.push({
      type: 'whale_cluster_24h',
      title: zh ? '24 小时鲸鱼密集活动' : 'Whale Cluster',
      severity: 'high',
      severityScore: 86,
      message: zh
        ? `最近 24 小时内出现了 ${signals.whaleTransferCount24h} 笔鲸鱼级别转账。`
        : `${signals.whaleTransferCount24h} whale-sized transfers landed in the last 24 hours.`,
      evidence: zh
        ? `24 小时最大动作：${describeTransfer(last24h.largestInbound, last24h.largestOutbound, language)}。`
        : `Largest 24h move: ${describeTransfer(last24h.largestInbound, last24h.largestOutbound, language)}.`
    });
  }

  if (signals.recentNetBias === 'accumulation') {
    alerts.push({
      type: 'large_inflow',
      title: zh ? '大额净流入' : 'Large Inflow',
      severity: 'high',
      severityScore: 82,
      message: zh
        ? '最近窗口内净流入显著为正，说明有新的资金正在进入这个钱包。'
        : 'Recent net flow is strongly positive, suggesting new capital entering the wallet.',
      evidence: zh
        ? `24 小时净流向：${formatTokenNet(last24h.net, language)}。`
        : `24h net flow: ${formatTokenNet(last24h.net, language)}.`
    });
  }

  if (signals.recentNetBias === 'distribution') {
    alerts.push({
      type: 'large_outflow',
      title: zh ? '大额净流出' : 'Large Outflow',
      severity: 'high',
      severityScore: 82,
      message: zh
        ? '最近窗口内净流出显著为负，常见于资金分发或资金池再平衡。'
        : 'Recent net flow is strongly negative, which often precedes treasury distribution or rebalancing.',
      evidence: zh
        ? `24 小时净流向：${formatTokenNet(last24h.net, language)}。`
        : `24h net flow: ${formatTokenNet(last24h.net, language)}.`
    });
  }

  if (last24h.maxTransfersIn30m >= 4 && last24h.uniqueCounterparties >= 3) {
    alerts.push({
      type: 'routing_burst',
      title: zh ? '可疑突发路由' : 'Suspicious Burst',
      severity: 'medium',
      severityScore: 68,
      message: zh
        ? `30 分钟内出现了 ${last24h.maxTransfersIn30m} 笔转账，并触达 ${last24h.uniqueCounterparties} 个对手方。`
        : `${last24h.maxTransfersIn30m} transfers landed within 30 minutes across ${last24h.uniqueCounterparties} counterparties.`,
      evidence: zh
        ? '这种模式常见于归集钱包、交易所批处理或运营路由。'
        : 'This pattern is common for routing wallets, exchange sweeps, and operational redistribution.'
    });
  }

  if (signals.activitySpikeRatio >= 0.7 && last24h.count >= 4) {
    alerts.push({
      type: 'reactivation',
      title: zh ? '近期重新活跃' : 'Recent Reactivation',
      severity: 'medium',
      severityScore: 62,
      message: zh
        ? '过去 7 天的大部分活动都集中在最近 24 小时。'
        : 'Most seven-day activity is concentrated inside the last 24 hours.',
      evidence: zh
        ? `约 ${Math.round(signals.activitySpikeRatio * 100)}% 的跟踪转账发生在最近一天。`
        : `${Math.round(signals.activitySpikeRatio * 100)}% of tracked transfers happened in the last day.`
    });
  }

  if (signals.crossTokenWhale) {
    alerts.push({
      type: 'cross_token_whale',
      title: zh ? '跨资产鲸鱼流动' : 'Cross-Asset Whale Flow',
      severity: 'medium',
      severityScore: 58,
      message: zh
        ? '鲸鱼级别的资金流同时触发了多个资产类别。'
        : 'Whale-sized movement hit more than one tracked asset class.',
      evidence: zh
        ? 'USDT 和 TRX 都出现了大额流动，这更像资金库级别的调仓，而不是随机零售行为。'
        : 'Large transfers were observed in both USDT and TRX, which often means a bigger treasury action.'
    });
  }

  if (topCounterparty && topCounterparty.interactions >= 3 && topCounterparty.shareOfInteractions >= 0.4) {
    alerts.push({
      type: 'counterparty_cluster',
      title: zh ? '对手方集群' : 'Counterparty Cluster',
      severity: 'low',
      severityScore: 45,
      message: zh
        ? '单一对手方正在反复与这个钱包发生交互。'
        : 'A single counterparty is repeatedly touching this wallet.',
      evidence: zh
        ? `${topCounterparty.address} 占最近跟踪交互的 ${Math.round(topCounterparty.shareOfInteractions * 100)}%。`
        : `${topCounterparty.address} accounts for ${Math.round(topCounterparty.shareOfInteractions * 100)}% of recent tracked interactions.`
    });
  }

  return alerts
    .sort((left, right) => right.severityScore - left.severityScore)
    .slice(0, 6);
}

function buildBehaviorTags(profile, alerts, signals, language) {
  const zh = isChinese(language);
  const tags = [profile.label];

  if (signals.megaTransferCount7d > 0) {
    tags.push(zh ? '超大额鲸鱼' : 'Mega Whale');
  } else if (signals.whaleTransferCount7d > 0) {
    tags.push(zh ? '鲸鱼级流动' : 'Whale Flow');
  }

  if (alerts.some((item) => item.type === 'routing_burst')) {
    tags.push(zh ? '突发活动' : 'Burst Activity');
  }

  if (signals.netBias === 'accumulation') {
    tags.push(zh ? '净买入' : 'Net Buyer');
  } else if (signals.netBias === 'distribution') {
    tags.push(zh ? '净卖出' : 'Net Seller');
  }

  if (signals.crossTokenWhale) {
    tags.push(zh ? '跨资产' : 'Cross-Asset');
  }

  return [...new Set(tags)];
}

function buildTokenBreakdown(transfers) {
  const breakdown = new Map();

  for (const transfer of transfers) {
    const current = breakdown.get(transfer.token) || {
      token: transfer.token,
      inbound: 0,
      outbound: 0,
      transactions: 0
    };

    current.transactions += 1;
    if (transfer.direction === 'in') {
      current.inbound = round(current.inbound + transfer.amount);
    } else {
      current.outbound = round(current.outbound + transfer.amount);
    }

    breakdown.set(transfer.token, current);
  }

  return [...breakdown.values()].map((entry) => ({
    ...entry,
    net: round(entry.inbound - entry.outbound)
  }));
}

function calculateActivityScore(window7d, signals, alerts) {
  let score = Math.min(window7d.count * 4, 36);
  score += Math.min(signals.whaleTransferCount7d * 10, 24);
  score += Math.min(signals.megaTransferCount7d * 12, 20);
  score += Math.min(window7d.uniqueCounterparties * 3, 12);
  score += Math.min(Math.round(signals.activitySpikeRatio * 12), 8);
  score += Math.min(alerts.length * 2, 8);
  return Math.min(score, 100);
}

function deriveAlertLevel(alerts) {
  if (alerts.some((item) => item.severity === 'high')) {
    return 'high';
  }

  if (alerts.some((item) => item.severity === 'medium')) {
    return 'medium';
  }

  if (alerts.length > 0) {
    return 'low';
  }

  return 'calm';
}

function classifyNetBias(netFlow) {
  const netUsdt = netFlow.USDT || 0;
  const netTrx = netFlow.TRX || 0;

  if (netUsdt >= MATERIAL_NET_THRESHOLDS.USDT || netTrx >= MATERIAL_NET_THRESHOLDS.TRX) {
    return 'accumulation';
  }

  if (netUsdt <= -MATERIAL_NET_THRESHOLDS.USDT || netTrx <= -MATERIAL_NET_THRESHOLDS.TRX) {
    return 'distribution';
  }

  return 'balanced';
}

function listMaterialNetTokens(netFlow) {
  return Object.entries(netFlow)
    .filter(([token, amount]) => Math.abs(amount) >= (MATERIAL_NET_THRESHOLDS[token] || Number.POSITIVE_INFINITY))
    .map(([token]) => token);
}

function pickDominantToken(netFlow, totalIn, totalOut) {
  const candidates = new Map();

  for (const [token, amount] of Object.entries(netFlow)) {
    candidates.set(token, Math.abs(amount));
  }

  for (const [token, amount] of Object.entries(totalIn)) {
    candidates.set(token, Math.max(candidates.get(token) || 0, amount));
  }

  for (const [token, amount] of Object.entries(totalOut)) {
    candidates.set(token, Math.max(candidates.get(token) || 0, amount));
  }

  return [...candidates.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function touchesMultipleWhaleAssets(transfers) {
  return new Set(transfers.map((item) => item.token)).size >= 2;
}

function describeLargestTransfers(transfers, language) {
  const sorted = [...transfers].sort((left, right) => right.amount - left.amount).slice(0, 2);
  if (sorted.length === 0) {
    return isChinese(language) ? '没有保留到超大额转账样本。' : 'No mega transfers were retained.';
  }

  return sorted.map((item) => describeSingleTransfer(item, language)).join(' / ');
}

function describeTransfer(largestInbound, largestOutbound, language) {
  const candidate =
    largestInbound?.amount >= (largestOutbound?.amount || 0) ? largestInbound : largestOutbound;

  return candidate ? describeSingleTransfer(candidate, language) : isChinese(language) ? '暂无' : 'not available yet';
}

function describeSingleTransfer(transfer, language) {
  const amount = formatAmount(transfer.amount, language);
  if (isChinese(language)) {
    return `${amount} ${transfer.token}${transfer.direction === 'in' ? '转入该钱包' : '转出该钱包'}`;
  }
  return `${amount} ${transfer.token} ${transfer.direction === 'in' ? 'into' : 'out of'} the wallet`;
}

function formatTokenNet(netFlow, language) {
  const entries = Object.entries(netFlow)
    .filter(([, amount]) => amount !== 0)
    .map(([token, amount]) => `${amount > 0 ? '+' : ''}${formatAmount(amount, language)} ${token}`);

  return entries.length > 0 ? entries.join(' / ') : isChinese(language) ? '基本持平' : 'Flat';
}

function formatAmount(amount, language) {
  return formatCompactNumber(amount, language, 1);
}

function buildProfile(code, confidence, language, rationaleEn, rationaleZh) {
  return {
    code,
    label: profileLabel(code, language),
    confidence,
    rationale: isChinese(language) ? rationaleZh : rationaleEn
  };
}

function profileLabel(code, language) {
  const zh = isChinese(language);
  const labels = {
    accumulation_whale: zh ? '吸筹型鲸鱼钱包' : 'Accumulation Whale',
    distribution_wallet: zh ? '分发型钱包' : 'Distribution Wallet',
    routing_wallet: zh ? '路由型钱包' : 'Routing Wallet',
    reactivated_treasury: zh ? '重新活跃的资金库钱包' : 'Reactivated Treasury',
    counterparty_hub_wallet: zh ? '对手方枢纽钱包' : 'Counterparty Hub Wallet',
    active_treasury_like_wallet: zh ? '活跃的资金库型钱包' : 'Active Treasury-Like Wallet',
    two_way_active_wallet: zh ? '双向活跃钱包' : 'Two-Way Active Wallet'
  };

  return labels[code] || (zh ? '待观察钱包' : 'Tracked Wallet');
}

function round(value) {
  return Number(value.toFixed(4));
}
