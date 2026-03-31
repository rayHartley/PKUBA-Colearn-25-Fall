const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.BASE_URL || 'http://localhost:3000');

const response = await fetch(`${baseUrl}/api/health`);
const payload = await response.json();

if (!response.ok) {
  console.error(`Health check failed: ${payload.message || response.statusText}`);
  process.exit(1);
}

const bank = payload.bankOfAi || {};

console.log('TRON Whale Radar / Bank of AI readiness');
console.log(`Base URL:            ${baseUrl}`);
console.log(`Mode:                ${bank.mode || payload.x402?.mode || 'unknown'}`);
console.log(`Ready:               ${bank.ready ? 'yes' : 'no'}`);
console.log(`Official facilitator:${bank.officialFacilitator ? 'yes' : 'no'}`);
console.log(`Has API key:         ${bank.hasApiKey ? 'yes' : 'no'}`);
console.log(`Has seller wallet:   ${bank.hasPayTo ? 'yes' : 'no'}`);
console.log(`Premium endpoint:    ${bank.premiumEndpoint || 'n/a'}`);
console.log(`Agent card:          ${bank.agentCardUrl || bank.registryHelper || 'n/a'}`);

if (bank.issues?.length) {
  console.log('Issues:');
  for (const issue of bank.issues) {
    console.log(`- ${issue}`);
  }
}

if (!bank.ready) {
  process.exitCode = 1;
}

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/u, '');
}
