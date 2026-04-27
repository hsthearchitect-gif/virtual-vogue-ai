import { Client } from '@gradio/client';

const spaces = [
  'Kwai-Kolors/Kolors-Virtual-Try-On',
  'franciszzj/Leffa',
];

for (const space of spaces) {
  console.log(`\nTesting: ${space}`);
  try {
    const app = await Client.connect(space);
    const endpoints = Object.keys(app.api_info?.named_endpoints || {});
    console.log('✅ Connected! Endpoints:', endpoints.slice(0, 5));
  } catch(e) {
    console.log('❌ Failed:', e.message.substring(0, 120));
  }
}
