import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCachedResource } from '../src/services/cache.js';

test('resolveCachedResource serves stale cache when live loader falls back', async () => {
  let callCount = 0;

  const live = await resolveCachedResource('test:cache:stale', {
    ttlMs: 1,
    forceRefresh: true,
    loader: async () => {
      callCount += 1;
      return { source: ['TronGrid'], value: 'live' };
    },
    isLiveValue: (payload) => !payload.source.includes('sample')
  });

  assert.equal(live.cache.status, 'live');
  assert.equal(live.value.value, 'live');

  const stale = await resolveCachedResource('test:cache:stale', {
    ttlMs: 1,
    forceRefresh: true,
    loader: async () => {
      callCount += 1;
      return { source: ['sample'], value: 'fallback' };
    },
    isLiveValue: (payload) => !payload.source.includes('sample'),
    fallbackReason: () => 'Current request returned fallback data.'
  });

  assert.equal(callCount, 2);
  assert.equal(stale.cache.status, 'stale');
  assert.equal(stale.value.value, 'live');
  assert.match(stale.cache.reason, /fallback data/u);
});
