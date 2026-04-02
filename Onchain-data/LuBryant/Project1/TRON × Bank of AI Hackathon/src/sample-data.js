const sampleWallets = [
  { label: 'Demo Wallet Alpha', address: 'TLa2f6VPqDgRE67v1736s7bJ8Ray5wYjU7' },
  { label: 'Demo Wallet Beta', address: 'TLbAurUFc9KpsfA1p8z4kR7C3m2YhPQqmf' },
  { label: 'Demo Wallet Gamma', address: 'TPyjyQxz9M8Y1paRrD8fWg5f7VJ7xR5sfd' },
  { label: 'Demo Routing Delta', address: 'TSTVYwL1ovJ4vB4N7zW9JpA8d3c2yXq8oK' }
];

export const demoAddress = sampleWallets[0].address;

export const fallbackMarketOverview = {
  timeframe: '24h',
  totalTransferValue: '23.4M TRX',
  totalTransactions: 1423128,
  activeAddresses: 385104,
  note: 'Fallback snapshot used because live TRONSCAN market data is temporarily unavailable.'
};

export const fallbackHotWallets = [
  {
    rank: 1,
    label: 'Demo Inflow Case',
    address: sampleWallets[0].address,
    direction: 'inflow',
    metricValue: '86/100',
    metricLabel: '7d whale radar score',
    supportingMetric: '18 tx across 2 tracked wallets',
    seedCount: 2,
    transactionCount: 18,
    profile: 'Demo leaderboard row',
    insight: 'Repeated large inbound USDT transfers suggest fresh capital arriving into the wallet.'
  },
  {
    rank: 2,
    label: 'Demo Outflow Case',
    address: sampleWallets[1].address,
    direction: 'outflow',
    metricValue: '73/100',
    metricLabel: '7d whale radar score',
    supportingMetric: '27 tx across 1 tracked wallet',
    seedCount: 1,
    transactionCount: 27,
    profile: 'Demo leaderboard row',
    insight: 'The wallet is distributing TRX across many counterparties in a short time window.'
  },
  {
    rank: 3,
    label: 'Demo Routing Case',
    address: sampleWallets[2].address,
    direction: 'mixed',
    metricValue: '61/100',
    metricLabel: '7d whale radar score',
    supportingMetric: '11 tx across 2 tracked wallets',
    seedCount: 2,
    transactionCount: 11,
    profile: 'Demo leaderboard row',
    insight: 'The flow pattern looks like a routing wallet balancing inflows and outbound sweeps.'
  }
];

export function buildSampleTransfers(address) {
  const now = Date.now();
  const counterpartyA = sampleWallets[1].address;
  const counterpartyB = sampleWallets[2].address;
  const counterpartyC = sampleWallets[3].address;

  return [
    {
      hash: 'sample-usdt-001',
      token: 'USDT',
      tokenType: 'TRC20',
      source: 'sample',
      timestamp: now - 2 * 60 * 60 * 1000,
      from: counterpartyA,
      to: address,
      counterparty: counterpartyA,
      direction: 'in',
      amount: 750000
    },
    {
      hash: 'sample-usdt-002',
      token: 'USDT',
      tokenType: 'TRC20',
      source: 'sample',
      timestamp: now - 5 * 60 * 60 * 1000,
      from: address,
      to: counterpartyB,
      counterparty: counterpartyB,
      direction: 'out',
      amount: 125000
    },
    {
      hash: 'sample-trx-003',
      token: 'TRX',
      tokenType: 'native',
      source: 'sample',
      timestamp: now - 7 * 60 * 60 * 1000,
      from: counterpartyC,
      to: address,
      counterparty: counterpartyC,
      direction: 'in',
      amount: 1800000
    },
    {
      hash: 'sample-usdt-004',
      token: 'USDT',
      tokenType: 'TRC20',
      source: 'sample',
      timestamp: now - 13 * 60 * 60 * 1000,
      from: counterpartyA,
      to: address,
      counterparty: counterpartyA,
      direction: 'in',
      amount: 420000
    },
    {
      hash: 'sample-trx-005',
      token: 'TRX',
      tokenType: 'native',
      source: 'sample',
      timestamp: now - 22 * 60 * 60 * 1000,
      from: address,
      to: counterpartyB,
      counterparty: counterpartyB,
      direction: 'out',
      amount: 960000
    },
    {
      hash: 'sample-usdt-006',
      token: 'USDT',
      tokenType: 'TRC20',
      source: 'sample',
      timestamp: now - 27 * 60 * 60 * 1000,
      from: address,
      to: counterpartyC,
      counterparty: counterpartyC,
      direction: 'out',
      amount: 96000
    },
    {
      hash: 'sample-usdt-007',
      token: 'USDT',
      tokenType: 'TRC20',
      source: 'sample',
      timestamp: now - 39 * 60 * 60 * 1000,
      from: counterpartyB,
      to: address,
      counterparty: counterpartyB,
      direction: 'in',
      amount: 210000
    },
    {
      hash: 'sample-trx-008',
      token: 'TRX',
      tokenType: 'native',
      source: 'sample',
      timestamp: now - 68 * 60 * 60 * 1000,
      from: address,
      to: counterpartyA,
      counterparty: counterpartyA,
      direction: 'out',
      amount: 650000
    },
    {
      hash: 'sample-usdt-009',
      token: 'USDT',
      tokenType: 'TRC20',
      source: 'sample',
      timestamp: now - 6 * 24 * 60 * 60 * 1000,
      from: counterpartyC,
      to: address,
      counterparty: counterpartyC,
      direction: 'in',
      amount: 99000
    }
  ];
}
