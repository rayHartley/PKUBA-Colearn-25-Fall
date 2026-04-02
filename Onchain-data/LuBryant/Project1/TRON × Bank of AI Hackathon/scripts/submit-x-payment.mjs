const baseUrl = normalizeBaseUrl(process.argv[2] || process.env.BASE_URL || 'http://localhost:3000');
const address = process.argv[3] || process.env.TRON_ADDRESS || '';
const xPayment = process.env.X_PAYMENT || '';
const demoPayment = process.env.X_DEMO_PAYMENT || '';

if (!address) {
  console.error('Usage: node scripts/submit-x-payment.mjs <baseUrl> <tronAddress>');
  console.error('You can also set BASE_URL and TRON_ADDRESS in the environment.');
  process.exit(1);
}

const premiumUrl = `${baseUrl}/api/premium/deep-dive?address=${encodeURIComponent(address)}`;

console.log(`Target premium URL: ${premiumUrl}`);
console.log('Step 1: requesting the 402 challenge...');

const challengeResponse = await fetch(premiumUrl);
const challengePayload = await challengeResponse.json();

console.log(`Challenge status: ${challengeResponse.status}`);
if (challengePayload.paymentRequirements?.[0]) {
  const requirement = challengePayload.paymentRequirements[0];
  console.log(`Price:            ${requirement.amountHuman} ${requirement.asset} on ${requirement.network}`);
  console.log(`Pay to:           ${requirement.payTo || 'not configured'}`);
}

if (!xPayment && !demoPayment) {
  console.log('No X_PAYMENT or X_DEMO_PAYMENT was provided, so the script stops after printing the challenge.');
  process.exit(0);
}

console.log('Step 2: submitting payment headers...');

const headers = {};
if (xPayment) {
  headers['X-PAYMENT'] = xPayment;
}
if (demoPayment) {
  headers['X-Demo-Payment'] = demoPayment;
}

const unlockResponse = await fetch(premiumUrl, { headers });
const unlockPayload = await unlockResponse.json();

console.log(`Unlock status:    ${unlockResponse.status}`);

if (unlockResponse.ok) {
  console.log('Premium unlock succeeded.');
  console.log(`Profile summary:  ${unlockPayload.premium?.profileSummary || 'n/a'}`);
  process.exit(0);
}

console.log(`Server message:   ${unlockPayload.note || unlockPayload.message || 'unknown error'}`);
if (unlockPayload.bankOfAi?.issues?.length) {
  console.log('Bank of AI issues:');
  for (const issue of unlockPayload.bankOfAi.issues) {
    console.log(`- ${issue}`);
  }
}
process.exitCode = 1;

function normalizeBaseUrl(value) {
  return String(value).replace(/\/+$/u, '');
}
