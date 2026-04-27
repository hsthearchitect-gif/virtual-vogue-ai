import { Client } from '@gradio/client';

console.log('Testing Leffa virtual try-on...\n');
const app = await Client.connect('franciszzj/Leffa');

// Check the API
const api = app.api_info;
console.log('API info:');
const vt = api?.named_endpoints?.['/leffa_predict_vt'];
if (vt) {
  console.log('VT inputs:', JSON.stringify(vt.parameters?.map(p => ({ name: p.label, type: p.component }))));
  console.log('VT outputs:', JSON.stringify(vt.returns?.map(r => ({ name: r.label, type: r.component }))));
}
