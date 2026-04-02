import fs from 'node:fs';

const publicBaseUrl = process.env.PUBLIC_BASE_URL;
const privateKey = process.env.BOAI_8004_PRIVATE_KEY;
const rpcUrl = process.env.BOAI_8004_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545';
const network = process.env.BOAI_8004_NETWORK || 'eip155:97';
const image = process.env.BOAI_AGENT_IMAGE || `${publicBaseUrl}/og.png`;

if (!publicBaseUrl || !privateKey) {
  console.error('Set PUBLIC_BASE_URL and BOAI_8004_PRIVATE_KEY before running this script.');
  process.exit(1);
}

let SDK;
try {
  ({ SDK } = await import('@bankofai/8004-sdk'));
} catch (error) {
  console.error('Install the optional SDK first: npm.cmd install @bankofai/8004-sdk');
  console.error(error.message);
  process.exit(1);
}

const sdk = new SDK({
  network,
  rpcUrl,
  signer: privateKey
});

const agent = sdk.createAgent({
  name: 'TRON Whale Radar',
  description:
    'AI on-chain data agent for whale tracking, premium wallet narratives, and x402-protected TRON insights.',
  image
});

agent.setA2A(`${publicBaseUrl}/agent-card.json`);
agent.setX402Support(true);
agent.setTrust({ reputation: true });
agent
  .addSkill('data_engineering/data_transformation_pipeline')
  .addSkill('natural_language_processing/summarization')
  .addDomain('finance_and_business/investment_services');

const registrationData = agent.toJSON();
fs.writeFileSync('tron-whale-radar-8004.json', JSON.stringify(registrationData, null, 2));

console.log('Saved local registration draft to tron-whale-radar-8004.json');
console.log('Upload that file to a public URL, then run the on-chain registration step:');
console.log(`const tx = await agent.register("${publicBaseUrl}/tron-whale-radar-8004.json");`);
