function getHeader(headers, name) {
  return headers[name] || headers[name.toLowerCase()] || null;
}

export function isBankOfAiFacilitator(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'facilitator.bankofai.io';
  } catch {
    return false;
  }
}

export function getBankOfAiConnectionStatus(config) {
  const officialFacilitator = isBankOfAiFacilitator(config.x402.facilitatorUrl);
  const hasApiKey = Boolean(config.x402.facilitatorApiKey);
  const hasPayTo = Boolean(config.x402.payTo);
  const issues = [];

  if (config.x402.mode !== 'facilitator') {
    issues.push('X402_MODE is not set to facilitator.');
  }

  if (!officialFacilitator) {
    issues.push('X402_FACILITATOR_URL must point to https://facilitator.bankofai.io for the official Bank of AI setup.');
  }

  if (!hasApiKey) {
    issues.push('X402_FACILITATOR_API_KEY is missing.');
  }

  if (!hasPayTo) {
    issues.push('X402_PAY_TO is missing.');
  }

  return {
    provider: 'bankofai',
    mode: config.x402.mode,
    facilitatorUrl: config.x402.facilitatorUrl,
    officialFacilitator,
    hasApiKey,
    hasPayTo,
    ready: config.x402.mode === 'facilitator' && officialFacilitator && hasApiKey && hasPayTo,
    adminUrl: 'https://admin.bankofai.io/',
    issues
  };
}

export function buildPaymentRequirement(config, resource) {
  const amountHuman = formatAtomicAmount(config.x402.priceAtomic, config.x402.assetDecimals);

  return {
    scheme: 'exact',
    network: config.x402.network,
    asset: config.x402.asset,
    assetAddress: config.x402.assetAddress,
    payTo: config.x402.payTo,
    amount: config.x402.priceAtomic,
    maxAmountRequired: config.x402.priceAtomic,
    amountHuman,
    resource,
    description: 'Premium TRON whale wallet deep dive',
    mimeType: 'application/json',
    maxTimeoutSeconds: 300
  };
}

export function buildPaymentChallenge(requirement, config, extra = {}) {
  const bankOfAi = getBankOfAiConnectionStatus(config);
  const body = {
    ok: false,
    code: 'PAYMENT_REQUIRED',
    message: 'x402 payment is required to unlock the premium wallet report.',
    paymentMode: config.x402.mode,
    paymentRequirements: [requirement],
    instructions:
      config.x402.mode === 'demo'
        ? [
            'Use the in-app demo unlock to simulate an x402 purchase.',
            'Switch X402_MODE=facilitator and configure the Bank of AI facilitator to verify live payments.'
          ]
        : [
            'Submit a valid X-PAYMENT header from an x402-capable client.',
            'This server will verify and settle the payment through the configured facilitator.'
          ],
    bankOfAi,
    ...extra
  };

  return {
    status: 402,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x402-version': '1',
      'payment-required': JSON.stringify(requirement),
      'www-authenticate': `X402 realm="${config.x402.realm}"`
    },
    body
  };
}

export function hasDemoPayment(headers, config) {
  return getHeader(headers, 'x-demo-payment') === config.x402.demoToken;
}

export function parsePaymentHeader(rawValue) {
  if (!rawValue) {
    return null;
  }

  const candidates = [rawValue];
  try {
    candidates.push(Buffer.from(rawValue, 'base64url').toString('utf8'));
  } catch {}
  try {
    candidates.push(Buffer.from(rawValue, 'base64').toString('utf8'));
  } catch {}

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return { raw: rawValue };
}

export async function authorizePremiumAccess(req, requirement, config) {
  if (config.x402.mode === 'demo') {
    if (hasDemoPayment(req.headers, config)) {
      return {
        authorized: true,
        payment: {
          mode: 'demo',
          settlementStatus: 'simulated',
          demoTokenUsed: true
        }
      };
    }

    return {
      authorized: false,
      challenge: buildPaymentChallenge(requirement, config)
    };
  }

  const bankOfAi = getBankOfAiConnectionStatus(config);
  if (!bankOfAi.ready) {
    return {
      authorized: false,
      challenge: buildPaymentChallenge(requirement, config, {
        note: bankOfAi.issues[0] || 'Bank of AI facilitator setup is incomplete.'
      })
    };
  }

  const rawPaymentHeader =
    getHeader(req.headers, 'x-payment') ||
    getHeader(req.headers, 'payment-signature') ||
    getHeader(req.headers, 'payment');

  if (!rawPaymentHeader) {
    return {
      authorized: false,
      challenge: buildPaymentChallenge(requirement, config, {
        note: 'No X-PAYMENT payload was attached to the request.'
      })
    };
  }

  if (!config.x402.facilitatorUrl) {
    return {
      authorized: false,
      challenge: buildPaymentChallenge(requirement, config, {
        note: 'X402_FACILITATOR_URL is not configured on the server. For Bank of AI, use https://facilitator.bankofai.io.'
      })
    };
  }

  const paymentPayload = parsePaymentHeader(rawPaymentHeader);

  try {
    const verify = await callFacilitator(config, '/verify', paymentPayload, requirement);
    const isValid = verify.isValid ?? verify.valid ?? verify.ok ?? false;
    if (!isValid) {
      return {
        authorized: false,
        challenge: buildPaymentChallenge(requirement, config, {
          note: verify.reason || verify.error || 'Payment verification failed.'
        })
      };
    }

    const settle = await callFacilitator(config, '/settle', paymentPayload, requirement);
    const settled = settle.settled ?? settle.success ?? settle.ok ?? true;
    if (!settled) {
      return {
        authorized: false,
        challenge: buildPaymentChallenge(requirement, config, {
          note: settle.reason || settle.error || 'Payment settlement failed.'
        })
      };
    }

    return {
      authorized: true,
      payment: {
        mode: 'facilitator',
        settlementStatus: 'settled',
        verify,
        settle
      }
    };
  } catch (error) {
    return {
      authorized: false,
      challenge: buildPaymentChallenge(requirement, config, {
        note: `Facilitator error: ${error.message}`
      })
    };
  }
}

async function callFacilitator(config, path, paymentPayload, paymentRequirement) {
  const url = new URL(path, config.x402.facilitatorUrl);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.x402.facilitatorApiKey
        ? {
            'x-api-key': config.x402.facilitatorApiKey,
            authorization: `Bearer ${config.x402.facilitatorApiKey}`
          }
        : {})
    },
    body: JSON.stringify({
      paymentPayload,
      paymentRequirement,
      paymentRequirements: paymentRequirement
    })
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const details =
      data.error ||
      data.message ||
      data.detail ||
      data.details ||
      (Array.isArray(data.errors) ? data.errors.map((item) => item.message || item.detail || JSON.stringify(item)).join('; ') : '') ||
      '';
    throw new Error(details ? `${details} (HTTP ${response.status})` : `Facilitator returned ${response.status}`);
  }

  return data;
}

function formatAtomicAmount(value, decimals) {
  const digits = String(value || '0').replace(/[^\d]/gu, '') || '0';
  const negative = String(value || '').startsWith('-');
  const padded = digits.padStart(decimals + 1, '0');
  const whole = padded.slice(0, -decimals) || '0';
  const fraction = padded.slice(-decimals).replace(/0+$/u, '');
  return `${negative ? '-' : ''}${whole}${fraction ? `.${fraction}` : ''}`;
}
