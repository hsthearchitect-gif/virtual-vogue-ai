import { Client } from '@gradio/client';

// Test IDM-VTON with a token - the token enables free quota reset
const HF_TOKEN = process.env.HF_TOKEN; // pass via: HF_TOKEN=hf_xxx node test_with_token.mjs

console.log(`HF_TOKEN present: ${HF_TOKEN ? '✅' : '❌ (set HF_TOKEN env var)'}\n`);

async function testSpace(spaceName, predictArgs) {
  console.log(`Testing ${spaceName}...`);
  try {
    const opts = HF_TOKEN ? { hf_token: HF_TOKEN } : {};
    const app  = await Client.connect(spaceName, opts);
    console.log('  Connected ✅');

    const humanRes   = await fetch('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=384&h=512&fit=crop');
    const garmentRes = await fetch('https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=384');
    const humanBlob   = await humanRes.blob();
    const garmentBlob = await garmentRes.blob();

    const result = await app.predict(...predictArgs(humanBlob, garmentBlob));
    const elapsed = 'done';
    const d = result.data?.[0];
    const url = d?.url || d?.path || (typeof d === 'string' ? d : null);
    console.log(`  Result URL: ${url?.substring(0, 80)}`);

    if (url) {
      const r = await fetch(url);
      const buf = await r.arrayBuffer();
      console.log(`  ✅✅ IMAGE OK: ${buf.byteLength} bytes\n`);
      return true;
    }
    console.log(`  ❌ No URL in output: ${JSON.stringify(d)?.substring(0, 100)}\n`);
    return false;
  } catch(e) {
    console.log(`  ❌ ${e.message.substring(0, 120)}\n`);
    return false;
  }
}

// Test IDM-VTON
const ok = await testSpace('yisol/IDM-VTON', (h, g) => ['/tryon', [
  { background: h, layers: [], composite: null },
  g,
  'casual shirt',
  true, true, 20, 42,
]]);

if (!ok) {
  // Test Leffa
  await testSpace('franciszzj/Leffa', (h, g) => ['/leffa_predict_vt', [
    h, g, true, 30, 2.5, 42, 'viton_hd', 'upper_body', true,
  ]]);
}
