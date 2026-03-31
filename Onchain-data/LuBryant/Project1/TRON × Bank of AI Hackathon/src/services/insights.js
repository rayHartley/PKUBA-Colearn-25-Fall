import { formatCompactNumber, normalizeLanguage, isChinese } from './lang.js';

export async function generateFreeInsights(analysis, config, language = analysis.language || 'en') {
  const lang = normalizeLanguage(language);
  const draft = buildFreeDraft(analysis, lang);
  return maybeEnhanceWithLlm('free', draft, analysis, config, lang);
}

export async function generatePremiumInsights(analysis, config, language = analysis.language || 'en') {
  const lang = normalizeLanguage(language);
  const draft = buildPremiumDraft(analysis, lang);
  return maybeEnhanceWithLlm('premium', draft, analysis, config, lang);
}

function buildFreeDraft(analysis, language) {
  const zh = isChinese(language);
  const window24h = analysis.windows['24h'];
  const window7d = analysis.windows['7d'];
  const topAlert = analysis.alerts[0];
  const topCounterparty = analysis.counterparties[0];

  return {
    headline: zh
      ? `${analysis.profile.label}：${describeNetFlow(window7d.net, language)}`
      : `${analysis.profile.label}: ${describeNetFlow(window7d.net, language)}`,
    summary: [
      zh
        ? `${analysis.whaleAlertLevel === 'high' ? '当前存在高优先级鲸鱼信号' : '当前存在值得跟踪的鲸鱼活动'}，最近 7 天共观察到 ${window7d.count} 笔转账、${window7d.uniqueCounterparties} 个对手方。`
        : `${analysis.whaleAlertLevel === 'high' ? 'High-priority whale movement' : 'Tracked whale movement'} across ${window7d.count} transfers and ${window7d.uniqueCounterparties} counterparties in the last 7 days.`,
      zh
        ? `最近最强的一次动作是${describeTransfer(window7d.largestInbound, window7d.largestOutbound, language)}。`
        : `The strongest recent move was ${describeTransfer(window7d.largestInbound, window7d.largestOutbound, language)}.`,
      topAlert
        ? `${topAlert.title}${zh ? '：' : ': '}${topAlert.message}`
        : zh
          ? '目前没有触发高优先级警报，但这个钱包仍然保持活跃，值得继续监控。'
          : 'No urgent whale alert fired, but the wallet remains active enough to monitor.'
    ],
    observations: [
      zh
        ? `24 小时净流向：${formatTokenNet(window24h.net, language)}。`
        : `24h net flow: ${formatTokenNet(window24h.net, language)}.`,
      zh
        ? `过去 7 天共出现 ${analysis.whaleSignals.whaleTransferCount7d} 笔鲸鱼级转账，以及 ${analysis.whaleSignals.megaTransferCount7d} 笔超大额转账。`
        : `${analysis.whaleSignals.whaleTransferCount7d} whale-sized transfers and ${analysis.whaleSignals.megaTransferCount7d} mega-sized transfers were observed over 7 days.`,
      topCounterparty
        ? zh
          ? `头号对手方 ${topCounterparty.address} 贡献了约 ${Math.round((topCounterparty.shareOfInteractions || 0) * 100)}% 的跟踪交互。`
          : `Top counterparty ${topCounterparty.address} contributed ${Math.round((topCounterparty.shareOfInteractions || 0) * 100)}% of tracked interactions.`
        : zh
          ? '当前还没有形成明显的单一对手方集群。'
          : 'No dominant counterparty cluster has formed yet.'
    ],
    model: {
      mode: 'template'
    }
  };
}

function buildPremiumDraft(analysis, language) {
  const zh = isChinese(language);
  const window24h = analysis.windows['24h'];
  const window7d = analysis.windows['7d'];
  const hypotheses = buildHypotheses(analysis, language);
  const topCounterparty = analysis.counterparties[0];

  return {
    profileSummary: zh
      ? `${analysis.profile.label}，活跃度评分 ${analysis.activityScore}/100，鲸鱼警报等级为 ${alertLevelLabel(analysis.whaleAlertLevel, language)}，共触发 ${analysis.alerts.length} 条信号。`
      : `${analysis.profile.label} with ${analysis.activityScore}/100 activity score, ${analysis.whaleAlertLevel} whale-alert level, and ${analysis.alerts.length} triggered signals.`,
    narrative: [
      zh
        ? `这个钱包当前更像${analysis.profile.label}，因为${analysis.profile.rationale}`
        : `The wallet currently looks like ${analysis.profile.label.toLowerCase()} because ${analysis.profile.rationale.toLowerCase()}`,
      zh
        ? `7 天净流向为 ${formatTokenNet(window7d.net, language)}，而最近 24 小时窗口的净流向为 ${formatTokenNet(window24h.net, language)}。`
        : `Seven-day flow sits at ${formatTokenNet(window7d.net, language)}, while the most recent 24-hour window shows ${formatTokenNet(window24h.net, language)}.`,
      zh
        ? `过去 7 天共出现 ${analysis.whaleSignals.whaleTransferCount7d} 笔鲸鱼级转账，最近最密集的 30 分钟窗口内有 ${analysis.whaleSignals.burstDensity24h} 笔转账，说明这是一个具备运营意义的钱包。`
        : `${analysis.whaleSignals.whaleTransferCount7d} whale-sized transfers and ${analysis.whaleSignals.burstDensity24h} transfers in the hottest 30-minute burst point to an operationally meaningful wallet.`
    ],
    hypotheses,
    actionItems: [
      buildPrimaryWatchpoint(analysis, language),
      topCounterparty
        ? zh
          ? `接下来 6 到 12 小时持续跟踪 ${topCounterparty.address}，判断它是否还会继续和该钱包联动，以确认是否属于同一内部集群。`
          : `Track ${topCounterparty.address} for follow-on transfers in the next 6-12 hours to confirm whether this is an internal cluster.`
        : zh
          ? '继续观察下一个出现的主导对手方；一旦重复出现，聚类置信度会快速提升。'
          : 'Track the next dominant counterparty that emerges; repeated touch points will quickly strengthen clustering confidence.',
      analysis.whaleSignals.crossTokenWhale
        ? zh
          ? '如果再次出现跨资产的大额动作，可以优先把它视为资金库级别的调仓，而不是一次性的孤立转账。'
          : 'If another cross-asset whale move appears, treat it as treasury-level repositioning instead of a one-off transfer.'
        : zh
          ? '下一次出现鲸鱼级转账时，先对照 TRON 整体市场波动，再判断它是钱包自身行为还是市场共振。'
          : 'Compare the next whale-sized transfer against TRON-wide market spikes before calling it wallet-specific alpha.'
    ],
    evidencePack: buildEvidencePack(analysis, language),
    monitoringPlaybook: buildMonitoringPlaybook(analysis, language),
    counterpartyHighlights: analysis.counterparties.map((item) => ({
      address: item.address,
      interactions: item.interactions,
      latestActivityAt: item.latestActivityAt
    })),
    model: {
      mode: 'template'
    }
  };
}

function buildHypotheses(analysis, language) {
  const zh = isChinese(language);
  const hypotheses = [];
  const topCounterparty = analysis.counterparties[0];

  if (analysis.profile.code === 'accumulation_whale') {
    hypotheses.push({
      title: zh ? '正在吸筹阶段' : 'Accumulation phase',
      confidence: zh ? '高' : 'high',
      rationale: zh
        ? '稳定币净流入占主导，而且已经连续堆积了多笔鲸鱼级别的转入。'
        : 'Inbound stablecoin flow dominates and the wallet has stacked multiple whale-sized deposits.'
    });
  }

  if (analysis.profile.code === 'distribution_wallet') {
    hypotheses.push({
      title: zh ? '分发或资金库再平衡' : 'Distribution or treasury rebalance',
      confidence: zh ? '中' : 'medium',
      rationale: zh
        ? '净流出显著强于净流入，而且资金被分散发送给多个接收方。'
        : 'Outbound movement is materially stronger than inbound activity and it is spread across several receivers.'
    });
  }

  if (analysis.profile.code === 'routing_wallet' || analysis.whaleSignals.burstDensity24h >= 4) {
    hypotheses.push({
      title: zh ? '具备运营路由特征' : 'Operational routing behavior',
      confidence: zh ? '中' : 'medium',
      rationale: zh
        ? '短时间内对多个对手方的密集执行，常见于归集、批量分发或交易所式路由。'
        : 'Burst execution across multiple counterparties often points to sweeps, batched redistribution, or exchange-style routing.'
    });
  }

  if (analysis.whaleSignals.activitySpikeRatio >= 0.7) {
    hypotheses.push({
      title: zh ? '钱包近期被重新激活' : 'Wallet reactivated recently',
      confidence: zh ? '中' : 'medium',
      rationale: zh
        ? '过去 7 天的大部分活动都集中在最近 24 小时。'
        : 'A large share of seven-day activity is concentrated inside the most recent 24-hour window.'
    });
  }

  if (topCounterparty && topCounterparty.interactions >= 3) {
    hypotheses.push({
      title: zh ? '对手方集中度较高' : 'Counterparty concentration',
      confidence: zh ? (topCounterparty.shareOfInteractions >= 0.45 ? '中' : '低') : topCounterparty.shareOfInteractions >= 0.45 ? 'medium' : 'low',
      rationale: zh
        ? `${topCounterparty.address} 重复出现，可能属于同一资金集群或执行操作者。`
        : `${topCounterparty.address} appears repeatedly and may belong to the same treasury cluster or execution operator.`
    });
  }

  if (analysis.whaleSignals.crossTokenWhale) {
    hypotheses.push({
      title: zh ? '跨资产资金库动作' : 'Cross-asset treasury action',
      confidence: zh ? '中' : 'medium',
      rationale: zh
        ? 'USDT 和 TRX 都出现了鲸鱼级流动，更像资金库调仓，而不是随机零售行为。'
        : 'Whale-sized movement is hitting both USDT and TRX, which is more consistent with treasury repositioning than random retail flow.'
    });
  }

  return hypotheses.slice(0, 4);
}

function buildEvidencePack(analysis, language) {
  const zh = isChinese(language);
  const topAlert = analysis.alerts[0];
  const topCounterparty = analysis.counterparties[0];

  return [
    {
      label: zh ? '鲸鱼警报等级' : 'Whale alert level',
      value: alertLevelLabel(analysis.whaleAlertLevel, language),
      explanation: topAlert
        ? `${topAlert.title}${zh ? '：' : ': '}${topAlert.evidence}`
        : zh
          ? '当前没有触发最高优先级信号。'
          : 'No top-priority signal fired.'
    },
    {
      label: zh ? '7 天净流向' : '7d net flow',
      value: formatTokenNet(analysis.windows['7d'].net, language),
      explanation: zh
        ? '这是过去 7 天窗口内按方向汇总后的净余额。'
        : 'This is the directional balance across the tracked seven-day window.'
    },
    {
      label: zh ? '突发密度' : 'Burst density',
      value: `${analysis.whaleSignals.burstDensity24h} ${zh ? '笔/30分钟' : 'tx / 30m'}`,
      explanation: zh
        ? '突发密度越高，越像运营路由或批量执行。'
        : 'Higher burst density increases the odds of operator routing or execution batching.'
    },
    {
      label: zh ? '头号对手方' : 'Top counterparty',
      value: topCounterparty ? topCounterparty.address : zh ? '尚未形成' : 'Not established',
      explanation: topCounterparty
        ? zh
          ? `共 ${topCounterparty.interactions} 次交互，占跟踪流量的 ${Math.round((topCounterparty.shareOfInteractions || 0) * 100)}%。`
          : `${topCounterparty.interactions} interactions and ${Math.round((topCounterparty.shareOfInteractions || 0) * 100)}% share of tracked flow.`
        : zh
          ? '当前观察期内没有单一对手方占据主导。'
          : 'No single counterparty dominates the observed period.'
    }
  ];
}

function buildMonitoringPlaybook(analysis, language) {
  const zh = isChinese(language);
  const dominantToken = analysis.whaleSignals.dominantToken || 'USDT/TRX';
  const netBias = analysis.whaleSignals.netBias;

  return [
    netBias === 'accumulation'
      ? zh
        ? `观察接下来 24 小时 ${dominantToken} 是否从净流入切换为净流出；这通常意味着吸筹阶段正在结束。`
        : `Watch whether ${dominantToken} switches from net inflow to net outflow in the next 24 hours; that would suggest the wallet is finishing an accumulation phase.`
      : zh
        ? `观察近期流出之后是否又出现新的 ${dominantToken} 净流入；如果有，说明这更像吸收后再分发，而不是单纯出货。`
        : `Watch whether fresh ${dominantToken} inflow appears after the recent outflow; that would signal absorption instead of pure distribution.`,
    analysis.whaleSignals.burstDensity24h >= 4
      ? zh
        ? '如果 30 分钟内再次出现密集突发，应该把它视为活跃路由节点，而不是被动资金库。'
        : 'If another tight burst lands within 30 minutes, treat the wallet as an active routing node rather than a passive treasury.'
      : zh
        ? '如果 30 分钟内的突发密度上升到 4 笔以上，应立即升级“路由钱包”判断。'
        : 'If burst density rises above 4 transfers in 30 minutes, upgrade the routing thesis immediately.',
    analysis.whaleSignals.topCounterpartyAddress
      ? zh
        ? `如果接下来 2 到 3 笔转账里 ${analysis.whaleSignals.topCounterpartyAddress} 再次出现，可以在 Demo 里把这两个钱包归为同一集群。`
        : `If ${analysis.whaleSignals.topCounterpartyAddress} appears again in the next 2-3 transfers, cluster the two wallets together in your live demo narrative.`
      : zh
        ? '如果某个对手方开始重复出现，这是在 Demo 中快速提升聚类置信度的最好方式。'
        : 'If a single counterparty begins repeating, that is the fastest way to improve clustering confidence during the demo.'
  ];
}

function buildPrimaryWatchpoint(analysis, language) {
  const zh = isChinese(language);

  if (analysis.whaleSignals.netBias === 'accumulation') {
    return zh
      ? '重点观察这一轮吸筹之后的下一次大额外流；那通常最能暴露钱包的真实意图。'
      : 'Watch for the next outbound sweep after this accumulation wave; that is often the move that gives the wallet true intent away.';
  }

  if (analysis.whaleSignals.netBias === 'distribution') {
    return zh
      ? '重点观察当前分发之后是否会快速补充资金；如果补得很快，更像运营钱包而不是终点沉淀地址。'
      : 'Watch whether the wallet receives replenishment after the current distribution wave; refilling quickly often means an operator wallet rather than a terminal sink.';
  }

  return zh
    ? '重点观察下一笔鲸鱼级转账是否会把这个钱包推向明确的吸筹或分发状态。'
    : 'Watch whether the next whale-sized transfer keeps the flow balanced or tips the wallet into a clear accumulation or distribution regime.';
}

async function maybeEnhanceWithLlm(kind, draft, analysis, config, language) {
  if (!config.llm.apiKey || !config.llm.baseUrl || !config.llm.model) {
    return draft;
  }

  const zh = isChinese(language);

  try {
    const response = await fetch(`${config.llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.llm.apiKey}`
      },
      body: JSON.stringify({
        model: config.llm.model,
        temperature: 0.15,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              kind === 'free'
                ? [
                    zh ? '你是一名严谨的 TRON 链上分析师。' : 'You are a precise TRON on-chain analyst.',
                    zh ? '只能返回严格 JSON。' : 'Return strict JSON only.',
                    zh ? '必须包含键：headline, summary, observations。' : 'Required keys: headline, summary, observations.',
                    zh ? 'summary 必须是恰好 3 条精炼中文字符串。' : 'summary must be an array of exactly 3 concise strings.',
                    zh ? 'observations 必须是恰好 3 条精炼中文字符串。' : 'observations must be an array of exactly 3 concise strings.',
                    zh ? '语气专业克制，只能基于给定分析证据。请使用中文。' : 'Be factual, avoid hype, and only use evidence provided in the analysis payload.'
                  ].join(' ')
                : [
                    zh ? '你是一名严谨的 TRON 链上分析师，正在撰写付费情报简报。' : 'You are a precise TRON on-chain analyst preparing a premium intelligence brief.',
                    zh ? '只能返回严格 JSON。' : 'Return strict JSON only.',
                    zh
                      ? '必须包含键：profileSummary, narrative, hypotheses, actionItems, evidencePack, monitoringPlaybook。'
                      : 'Required keys: profileSummary, narrative, hypotheses, actionItems, evidencePack, monitoringPlaybook.',
                    zh ? 'narrative 必须是 3 条精炼中文字符串。' : 'narrative must be an array of 3 concise strings.',
                    zh ? 'hypotheses 最多 4 条，每条包含 title, confidence, rationale，并使用中文。' : 'hypotheses must be an array of up to 4 objects with title, confidence, rationale.',
                    zh ? 'actionItems 必须是 3 条精炼中文字符串。' : 'actionItems must be an array of 3 concise strings.',
                    zh ? 'evidencePack 最多 4 条，每条包含 label, value, explanation。' : 'evidencePack must be an array of up to 4 objects with label, value, explanation.',
                    zh ? 'monitoringPlaybook 必须是 3 条精炼中文字符串。' : 'monitoringPlaybook must be an array of 3 concise strings.',
                    zh ? '语气专业克制，只能基于给定证据，请使用中文。' : 'Keep the tone professional and grounded in the supplied evidence.'
                  ].join(' ')
          },
          {
            role: 'user',
            content: JSON.stringify({
              kind,
              language,
              analysis,
              draft
            })
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`LLM HTTP ${response.status}`);
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content || '';
    const parsed = extractJsonObject(content);
    if (!parsed) {
      throw new Error('LLM did not return valid JSON');
    }

    return {
      ...draft,
      ...sanitize(kind, parsed),
      model: {
        mode: 'llm',
        model: config.llm.model
      }
    };
  } catch (error) {
    return {
      ...draft,
      model: {
        mode: 'template',
        fallbackReason: error.message
      }
    };
  }
}

function sanitize(kind, parsed) {
  if (kind === 'free') {
    return compactObject({
      headline: sanitizeString(parsed.headline),
      summary: sanitizeStringArray(parsed.summary, 3),
      observations: sanitizeStringArray(parsed.observations, 3)
    });
  }

  return compactObject({
    profileSummary: sanitizeString(parsed.profileSummary),
    narrative: sanitizeStringArray(parsed.narrative, 3),
    hypotheses: sanitizeHypotheses(parsed.hypotheses),
    actionItems: sanitizeStringArray(parsed.actionItems, 3),
    evidencePack: sanitizeEvidencePack(parsed.evidencePack),
    monitoringPlaybook: sanitizeStringArray(parsed.monitoringPlaybook, 3)
  });
}

function sanitizeString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function sanitizeStringArray(value, maxItems) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);

  return items.length > 0 ? items : undefined;
}

function sanitizeHypotheses(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => ({
      title: sanitizeString(item?.title),
      confidence: sanitizeString(item?.confidence),
      rationale: sanitizeString(item?.rationale)
    }))
    .filter((item) => item.title && item.confidence && item.rationale)
    .slice(0, 4);

  return items.length > 0 ? items : undefined;
}

function sanitizeEvidencePack(value) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value
    .map((item) => ({
      label: sanitizeString(item?.label),
      value: sanitizeString(item?.value),
      explanation: sanitizeString(item?.explanation)
    }))
    .filter((item) => item.label && item.value && item.explanation)
    .slice(0, 4);

  return items.length > 0 ? items : undefined;
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function extractJsonObject(content) {
  if (!content) {
    return null;
  }

  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(content.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function describeNetFlow(netFlow, language) {
  const directions = [];
  const zh = isChinese(language);

  for (const [token, amount] of Object.entries(netFlow)) {
    if (!amount) {
      continue;
    }

    directions.push(
      zh
        ? `${amount > 0 ? '净流入' : '净流出'} ${token}`
        : `${amount > 0 ? 'net inflow' : 'net outflow'} in ${token}`
    );
  }

  return directions.length > 0 ? directions.join(zh ? ' + ' : ' + ') : zh ? '目前基本平衡' : 'balanced flow so far';
}

function describeTransfer(largestInbound, largestOutbound, language) {
  const candidate =
    largestInbound?.amount >= (largestOutbound?.amount || 0) ? largestInbound : largestOutbound;

  return candidate ? describeSingleTransfer(candidate, language) : isChinese(language) ? '暂无明显动作' : 'not available yet';
}

function describeSingleTransfer(transfer, language) {
  return isChinese(language)
    ? `${formatAmount(transfer.amount, language)} ${transfer.token}${transfer.direction === 'in' ? '转入该钱包' : '转出该钱包'}`
    : `${formatAmount(transfer.amount, language)} ${transfer.token} ${transfer.direction === 'in' ? 'into' : 'out of'} the wallet`;
}

function formatAmount(amount, language) {
  return formatCompactNumber(amount, language, 1);
}

function formatTokenNet(netFlow, language) {
  const entries = Object.entries(netFlow)
    .filter(([, amount]) => amount !== 0)
    .map(([token, amount]) => `${amount > 0 ? '+' : ''}${formatAmount(amount, language)} ${token}`);

  return entries.length > 0 ? entries.join(' / ') : isChinese(language) ? '基本持平' : 'Flat';
}

function alertLevelLabel(level, language) {
  if (!isChinese(language)) {
    return level;
  }

  const mapping = {
    high: '高',
    medium: '中',
    low: '低',
    calm: '平稳'
  };

  return mapping[level] || level;
}
