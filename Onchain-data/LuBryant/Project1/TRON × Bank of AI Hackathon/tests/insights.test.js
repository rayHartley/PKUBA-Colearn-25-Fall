import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWalletActivity } from '../src/services/analysis.js';
import { buildSampleTransfers, demoAddress } from '../src/sample-data.js';
import { generatePremiumInsights } from '../src/services/insights.js';

test('premium insights include evidence pack and monitoring playbook without llm', async () => {
  const analysis = analyzeWalletActivity(demoAddress, buildSampleTransfers(demoAddress), Date.now());
  const premium = await generatePremiumInsights(analysis, {
    llm: {
      apiKey: '',
      baseUrl: '',
      model: ''
    }
  });

  assert.ok(premium.profileSummary.length > 0);
  assert.equal(premium.narrative.length, 3);
  assert.ok(premium.hypotheses.length >= 1);
  assert.equal(premium.actionItems.length, 3);
  assert.equal(premium.evidencePack.length, 4);
  assert.equal(premium.monitoringPlaybook.length, 3);
  assert.equal(premium.model.mode, 'template');
});
