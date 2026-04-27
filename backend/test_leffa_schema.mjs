import { Client } from '@gradio/client';

const app = await Client.connect('franciszzj/Leffa');
const vt = app.api_info?.named_endpoints?.['/leffa_predict_vt'];
console.log('Full parameter details:');
vt?.parameters?.forEach((p, i) => {
  console.log(`  [${i}] "${p.label}" type:${p.component} choices:${JSON.stringify(p.props?.choices)}`);
});
