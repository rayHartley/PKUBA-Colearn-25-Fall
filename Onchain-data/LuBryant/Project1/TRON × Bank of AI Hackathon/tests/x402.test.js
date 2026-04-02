import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizePremiumAccess,
  buildPaymentChallenge,
  buildPaymentRequirement,
  getBankOfAiConnectionStatus,
  hasDemoPayment,
  isBankOfAiFacilitator,
  parsePaymentHeader
} from '../src/services/x402.js';

const config = {
  x402: {
    mode: 'demo',
    network: 'tron-nile',
    asset: 'USDT',
    assetAddress: '',
    payTo: '',
    priceAtomic: '1000000',
    assetDecimals: 6,
    demoToken: 'demo-paid',
    realm: 'TRON Whale Radar Premium',
    facilitatorUrl: '',
    facilitatorApiKey: ''
  }
};

test('buildPaymentRequirement returns x402 metadata', () => {
  const requirement = buildPaymentRequirement(config, 'http://localhost/api/premium/deep-dive?address=abc');
  assert.equal(requirement.amount, '1000000');
  assert.equal(requirement.asset, 'USDT');
});

test('parsePaymentHeader accepts JSON and base64', () => {
  const raw = JSON.stringify({ tx: 'abc' });
  assert.deepEqual(parsePaymentHeader(raw), { tx: 'abc' });
  assert.deepEqual(parsePaymentHeader(Buffer.from(raw).toString('base64url')), { tx: 'abc' });
});

test('demo mode requires the demo payment header', async () => {
  const requirement = buildPaymentRequirement(config, 'http://localhost/api/premium/deep-dive');
  assert.equal(hasDemoPayment({ 'x-demo-payment': 'demo-paid' }, config), true);

  const denied = await authorizePremiumAccess({ headers: {} }, requirement, config);
  assert.equal(denied.authorized, false);
  assert.equal(denied.challenge.status, 402);

  const allowed = await authorizePremiumAccess(
    { headers: { 'x-demo-payment': 'demo-paid' } },
    requirement,
    config
  );
  assert.equal(allowed.authorized, true);
  assert.equal(allowed.payment.mode, 'demo');

  const challenge = buildPaymentChallenge(requirement, config);
  assert.equal(challenge.status, 402);
});

test('Bank of AI facilitator detection only accepts the official facilitator host', () => {
  assert.equal(isBankOfAiFacilitator('https://facilitator.bankofai.io'), true);
  assert.equal(isBankOfAiFacilitator('https://api.bankofai.io/v1/chat/completions'), false);
});

test('Bank of AI connection status requires official facilitator, api key, and payTo', () => {
  const status = getBankOfAiConnectionStatus({
    x402: {
      ...config.x402,
      mode: 'facilitator',
      facilitatorUrl: 'https://api.bankofai.io/v1/chat/completions',
      facilitatorApiKey: '',
      payTo: ''
    }
  });

  assert.equal(status.ready, false);
  assert.equal(status.officialFacilitator, false);
  assert.ok(status.issues.length >= 2);
});
