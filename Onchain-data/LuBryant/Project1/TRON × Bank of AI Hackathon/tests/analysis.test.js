import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWalletActivity } from '../src/services/analysis.js';
import { buildSampleTransfers, demoAddress } from '../src/sample-data.js';

test('analysis detects whale-style flow from sample transfers', () => {
  const analysis = analyzeWalletActivity(demoAddress, buildSampleTransfers(demoAddress), Date.now());

  assert.equal(analysis.address, demoAddress);
  assert.ok(analysis.windows['7d'].count >= 8);
  assert.ok(analysis.windows['7d'].largeTransfers.length >= 3);
  assert.ok(analysis.whaleSignals.megaTransferCount7d >= 1);
  assert.equal(typeof analysis.whaleAlertLevel, 'string');
  assert.ok(analysis.alerts.some((alert) => alert.type === 'mega_transfer' || alert.type === 'whale_cluster_24h'));
  assert.ok(analysis.alerts[0].title.length > 0);
  assert.ok(analysis.alerts[0].evidence.length > 0);
  assert.ok(analysis.profile.label.length > 0);
  assert.ok(analysis.counterparties.length > 0);
});
