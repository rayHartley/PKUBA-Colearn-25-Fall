import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWalletActivity } from '../src/services/analysis.js';
import { buildCounterpartyLeaderboardRows } from '../src/services/tron-data.js';

test('leaderboard ranks repeat counterparties across tracked wallets above one-off flows', () => {
  const now = Date.UTC(2026, 2, 31, 12, 0, 0);
  const seedA = { label: 'Seed Alpha', address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7' };
  const seedB = { label: 'Seed Beta', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' };
  const sharedCounterparty = 'TPyjyQxz9M8Y1paRrD8fWg5f7VJ7xR5sfd';
  const uniqueCounterpartyA = 'TLbAurUFc9KpsfA1p8z4kR7C3m2YhPQqmf';
  const uniqueCounterpartyB = 'TSTVYwL1ovJ4vB4N7zW9JpA8d3c2yXq8oK';

  const analyses = [
    {
      seed: seedA,
      analysis: analyzeWalletActivity(
        seedA.address,
        [
          buildTransfer('a-1', 'USDT', sharedCounterparty, seedA.address, sharedCounterparty, 'in', 200000, now - 60 * 60 * 1000),
          buildTransfer('a-2', 'USDT', sharedCounterparty, seedA.address, sharedCounterparty, 'in', 120000, now - 2 * 60 * 60 * 1000),
          buildTransfer('a-3', 'TRX', seedA.address, sharedCounterparty, sharedCounterparty, 'out', 600000, now - 3 * 60 * 60 * 1000),
          buildTransfer('a-4', 'TRX', uniqueCounterpartyA, seedA.address, uniqueCounterpartyA, 'in', 850000, now - 4 * 60 * 60 * 1000)
        ],
        now
      )
    },
    {
      seed: seedB,
      analysis: analyzeWalletActivity(
        seedB.address,
        [
          buildTransfer('b-1', 'USDT', sharedCounterparty, seedB.address, sharedCounterparty, 'in', 150000, now - 30 * 60 * 1000),
          buildTransfer('b-2', 'TRX', seedB.address, sharedCounterparty, sharedCounterparty, 'out', 1000000, now - 90 * 60 * 1000),
          buildTransfer('b-3', 'TRX', seedB.address, uniqueCounterpartyB, uniqueCounterpartyB, 'out', 700000, now - 5 * 60 * 60 * 1000)
        ],
        now
      )
    }
  ];

  const rows = buildCounterpartyLeaderboardRows(analyses, {
    defaultWatchlist: [seedA, seedB],
    hotWalletMaxRows: 5
  }, now);

  assert.equal(rows.length, 3);
  assert.equal(rows[0].address, sharedCounterparty);
  assert.equal(rows[0].seedCount, 2);
  assert.equal(rows[0].rank, 1);
  assert.equal(rows[0].metricLabel, '7d whale radar score');
  assert.match(rows[0].metricValue, /^\d+\/100$/u);
  assert.ok(rows[0].score > rows[1].score);
});

function buildTransfer(hash, token, from, to, counterparty, direction, amount, timestamp) {
  return {
    hash,
    token,
    tokenType: token === 'TRX' ? 'native' : 'TRC20',
    source: 'test',
    timestamp,
    from,
    to,
    counterparty,
    direction,
    amount
  };
}
