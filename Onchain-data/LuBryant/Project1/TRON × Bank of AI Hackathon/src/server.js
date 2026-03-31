import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { config } from './config.js';
import { demoAddress } from './sample-data.js';
import { isValidTronAddress, analyzeWalletActivity } from './services/analysis.js';
import { resolveCachedResource } from './services/cache.js';
import { generateFreeInsights, generatePremiumInsights } from './services/insights.js';
import { fetchHotWallets, fetchWalletActivity } from './services/tron-data.js';
import { normalizeLanguage } from './services/lang.js';
import {
  authorizePremiumAccess,
  buildPaymentRequirement,
  getBankOfAiConnectionStatus,
  isBankOfAiFacilitator
} from './services/x402.js';

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `localhost:${config.port}`}`);
    const language = normalizeLanguage(url.searchParams.get('lang'));

    if (url.pathname === '/api/health') {
      const bankOfAi = getBankOfAiConnectionStatus(config);
      const requestBaseUrl = url.origin;
      const premiumEndpoint = `${requestBaseUrl}/api/premium/deep-dive`;
      const agentCardUrl = `${requestBaseUrl}/agent-card.json`;
      const paymentRequirement = buildPaymentRequirement(config, premiumEndpoint);
      return sendJson(res, 200, {
        ok: true,
        service: config.appName,
        language,
        generatedAt: new Date().toISOString(),
        defaultAddress: config.defaultWatchlist[0]?.address || demoAddress,
        watchlist: config.defaultWatchlist,
        x402: {
          mode: config.x402.mode,
          network: config.x402.network,
          asset: config.x402.asset,
          priceAtomic: config.x402.priceAtomic,
          demoToken: config.x402.mode === 'demo' ? config.x402.demoToken : null,
          facilitatorUrl: config.x402.facilitatorUrl,
          officialFacilitator: isBankOfAiFacilitator(config.x402.facilitatorUrl)
        },
        cache: {
          overviewTtlMs: config.overviewCacheTtlMs,
          hotWalletsTtlMs: config.hotWalletsCacheTtlMs
        },
        bankOfAi: {
          ...bankOfAi,
          x402Connected: bankOfAi.ready,
          registryHelper: agentCardUrl,
          agentCardUrl,
          premiumEndpoint,
          healthEndpoint: `${requestBaseUrl}/api/health`,
          configuredPublicBaseUrl: config.publicBaseUrl,
          payTo: config.x402.payTo,
          asset: config.x402.asset,
          network: config.x402.network,
          priceAtomic: config.x402.priceAtomic,
          priceHuman: paymentRequirement.amountHuman
        }
      });
    }

    if (url.pathname === '/api/free/hot-wallets') {
      const forceRefresh = url.searchParams.get('refresh') === '1';
      const cached = await resolveCachedResource(`hot-wallets:${language}`, {
        ttlMs: config.hotWalletsCacheTtlMs,
        forceRefresh,
        loader: () => fetchHotWallets(config, language),
        isLiveValue: (payload) => !payload.source?.includes('sample'),
        fallbackReason: () => 'Current hot-wallet request fell back to demo data.'
      });

      const payload = mergeCacheStatus(cached.value, cached.cache);
      return sendJson(res, 200, {
        ok: true,
        generatedAt: new Date().toISOString(),
        ...payload
      });
    }

    if (url.pathname === '/api/free/overview') {
      const address = (url.searchParams.get('address') || '').trim();
      const forceRefresh = url.searchParams.get('refresh') === '1';
      if (!isValidTronAddress(address)) {
        return sendJson(res, 400, {
          ok: false,
          message: language === 'zh-CN' ? '请输入一个有效的 TRON 地址。' : 'Please provide a valid TRON address.'
        });
      }

      const envelope = await getOverviewEnvelope(address, forceRefresh, language);
      const payload = await buildOverviewPayload(envelope.value, false, envelope.cache);
      return sendJson(res, 200, payload);
    }

    if (url.pathname === '/api/premium/deep-dive') {
      const address = (url.searchParams.get('address') || '').trim();
      const forceRefresh = url.searchParams.get('refresh') === '1';
      if (!isValidTronAddress(address)) {
        return sendJson(res, 400, {
          ok: false,
          message: language === 'zh-CN' ? '请输入一个有效的 TRON 地址。' : 'Please provide a valid TRON address.'
        });
      }

      const resource = `${config.publicBaseUrl}/api/premium/deep-dive?address=${encodeURIComponent(address)}&lang=${encodeURIComponent(language)}`;
      const paymentRequirement = buildPaymentRequirement(config, resource);
      const paymentGate = await authorizePremiumAccess(req, paymentRequirement, config);

      if (!paymentGate.authorized) {
        return sendJson(
          res,
          paymentGate.challenge.status,
          paymentGate.challenge.body,
          paymentGate.challenge.headers
        );
      }

      const envelope = await getOverviewEnvelope(address, forceRefresh, language);
      const payload = await buildOverviewPayload(envelope.value, true, envelope.cache);
      return sendJson(res, 200, {
        ...payload,
        payment: paymentGate.payment
      });
    }

    if (url.pathname === '/agent-card.json') {
      return sendJson(res, 200, buildAgentCard());
    }

    return serveStaticAsset(url.pathname, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, {
      ok: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

server.listen(config.port, () => {
  console.log(`${config.appName} is running on ${config.publicBaseUrl}`);
});

async function getOverviewEnvelope(address, forceRefresh = false, language = 'en') {
  return resolveCachedResource(`overview:${address}:${language}`, {
    ttlMs: config.overviewCacheTtlMs,
    forceRefresh,
    loader: async () => {
      const activity = await fetchWalletActivity(address, config);
      const analysis = analyzeWalletActivity(address, activity.transfers, Date.now(), language);
      const freeInsights = await generateFreeInsights(analysis, config, language);

      return {
        address,
        activity,
        analysis,
        freeInsights
      };
    },
    isLiveValue: (payload) => !payload.activity?.source?.includes('sample'),
    fallbackReason: () => 'Current overview request fell back to sample activity.'
  });
}

async function buildOverviewPayload(envelope, includePremium, cache) {
  const { address, activity, analysis, freeInsights } = envelope;
  const diagnostics = [...activity.diagnostics];
  let degraded = activity.degraded;

  if (cache?.status === 'stale' && cache.reason) {
    degraded = true;
    diagnostics.push(`Serving cached live snapshot: ${cache.reason}`);
  }

  if (cache?.status === 'fallback' && cache.reason) {
    diagnostics.push(cache.reason);
  }

  const payload = {
    ok: true,
    address,
    language: analysis.language,
    generatedAt: analysis.generatedAt,
    latestActivityAt: analysis.latestActivityAt,
    degraded,
    diagnostics,
    source: activity.source,
    cache,
    headline: freeInsights.headline,
    summary: freeInsights.summary,
    observations: freeInsights.observations,
    model: freeInsights.model,
    activityScore: analysis.activityScore,
    whaleAlertLevel: analysis.whaleAlertLevel,
    whaleSignals: analysis.whaleSignals,
    behaviorTags: analysis.behaviorTags,
    profile: analysis.profile,
    alerts: analysis.alerts,
    windows: analysis.windows,
    tokenBreakdown: analysis.tokenBreakdown,
    counterparties: analysis.counterparties,
    transfers: analysis.recentTransfers.map((item) => ({
      ...item,
      timestamp: new Date(item.timestamp).toISOString()
    }))
  };

  if (includePremium) {
    payload.premium = await generatePremiumInsights(analysis, config, analysis.language);
  }

  return payload;
}

function mergeCacheStatus(payload, cache) {
  const merged = {
    ...payload,
    cache
  };

  if (cache?.status === 'stale' && cache.reason) {
    merged.degraded = true;
    merged.diagnostics = [...(merged.diagnostics || []), `Serving cached live snapshot: ${cache.reason}`];
  }

  return merged;
}

function buildAgentCard() {
  return {
    name: config.appName,
    description:
      'AI on-chain data agent for TRON whale tracking with free wallet summaries and x402-protected premium insights.',
    version: '0.1.0',
    active: true,
    x402support: true,
    endpoints: [
      {
        name: 'A2A',
        endpoint: `${config.publicBaseUrl}/agent-card.json`,
        version: '0.1.0',
        a2aSkills: ['tron-whale-overview', 'tron-premium-deep-dive']
      },
      {
        name: 'HTTP',
        endpoint: `${config.publicBaseUrl}/api/free/overview`,
        version: 'v1'
      }
    ],
    metadata: {
      premiumEndpoint: `${config.publicBaseUrl}/api/premium/deep-dive`,
      hotWalletEndpoint: `${config.publicBaseUrl}/api/free/hot-wallets`,
      network: 'TRON',
      paymentProtocol: 'x402',
      bankOfAi: {
        ...getBankOfAiConnectionStatus(config)
      }
    }
  };
}

async function serveStaticAsset(requestPath, res) {
  const filePath = path.normalize(
    path.join(config.publicDir, requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/u, ''))
  );

  if (!filePath.startsWith(config.publicDir)) {
    return sendJson(res, 403, { ok: false, message: 'Forbidden' });
  }

  try {
    const file = await readFile(filePath);
    const extension = path.extname(filePath);
    res.writeHead(200, {
      'content-type': MIME_TYPES[extension] || 'application/octet-stream'
    });
    res.end(file);
  } catch {
    sendJson(res, 404, { ok: false, message: 'Not found' });
  }
}

function sendJson(res, statusCode, payload, headers = {}) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    ...headers
  });
  res.end(JSON.stringify(payload, null, 2));
}
