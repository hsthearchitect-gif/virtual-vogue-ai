import { Client } from '@gradio/client';

// Find try-on spaces that actually work without hitting quota
const spaces = [
  'Nymbo/Virtual-Try-On',
  'HumanAIGC/outfit-anyone-online',
  'BoyuanJackchen/IDM-VTON-fluxdev',
  'kadirnar/IDM-VTON',
  'YYJJ/Virtual-Try-On',
];

for (const space of spaces) {
  process.stdout.write(`Testing ${space}... `);
  try {
    const app = await Client.connect(space, { timeout: 8000 });
    const endpoints = Object.keys(app.api_info?.named_endpoints || {});
    const numEndpoints = Object.keys(app.api_info?.unnamed_endpoints || {}).length;
    console.log(`✅  named:[${endpoints.join(',')}]  unnamed:${numEndpoints}`);
  } catch(e) {
    console.log(`❌  ${e.message.substring(0, 80)}`);
  }
}
