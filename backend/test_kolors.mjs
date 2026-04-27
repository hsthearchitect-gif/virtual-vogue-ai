import { Client } from '@gradio/client';

// Kolors connected before - check its unnamed endpoints
console.log('Checking Kolors space deeply...\n');
const app = await Client.connect('Kwai-Kolors/Kolors-Virtual-Try-On');

const info = app.api_info;
const unnamed = info?.unnamed_endpoints || {};
const named = info?.named_endpoints || {};

console.log('Named endpoints:', Object.keys(named));
console.log('Unnamed endpoint count:', Object.keys(unnamed).length);

for (const [key, ep] of Object.entries(unnamed)) {
  const inputs = ep.parameters?.map(p => p.component || p.type);
  const outputs = ep.returns?.map(r => r.component || r.type);
  if (inputs?.includes('Image') || inputs?.includes('image')) {
    console.log(`\nEndpoint ${key}:`);
    console.log('  inputs:', inputs);
    console.log('  outputs:', outputs);
  }
}

// Also try with hf_token env var
const HF_TOKEN = process.env.HF_TOKEN;
if (HF_TOKEN) {
  console.log('\nTrying IDM-VTON with HF token...');
  try {
    const authedApp = await Client.connect('yisol/IDM-VTON', { hf_token: HF_TOKEN });
    console.log('✅ Connected with token!');
  } catch(e) {
    console.log('❌ Failed with token:', e.message);
  }
}
