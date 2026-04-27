import { Client } from '@gradio/client';

console.log('=== Full Leffa Pipeline Test ===\n');

try {
  console.log('1. Connecting to Leffa...');
  const app = await Client.connect('franciszzj/Leffa');
  console.log('   ✅ Connected\n');

  console.log('2. Fetching test images...');
  const humanRes   = await fetch('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=384&h=512&fit=crop');
  const garmentRes = await fetch('https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=384');
  const humanBlob   = await humanRes.blob();
  const garmentBlob = await garmentRes.blob();
  console.log(`   Human blob: ${humanBlob.size} bytes, type: ${humanBlob.type}`);
  console.log(`   Garment blob: ${garmentBlob.size} bytes, type: ${garmentBlob.type}\n`);

  console.log('3. Calling /leffa_predict_vt...');
  const start = Date.now();

  const result = await app.predict('/leffa_predict_vt', [
    humanBlob,
    garmentBlob,
    true,
    30,
    2.5,
    42,
    'viton_hd',
    'upper_body',
    'image',
  ]);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`   ✅ Got response in ${elapsed}s\n`);

  console.log('4. Inspecting output...');
  const data = result?.data;
  console.log(`   data length: ${data?.length}`);
  for (let i = 0; i < (data?.length || 0); i++) {
    const item = data[i];
    console.log(`   data[${i}] type: ${typeof item}`);
    if (typeof item === 'object' && item !== null) {
      console.log(`   data[${i}] keys: ${Object.keys(item).join(', ')}`);
      console.log(`   data[${i}].url: ${item.url}`);
      console.log(`   data[${i}].path: ${item.path}`);
    } else {
      console.log(`   data[${i}]: ${String(item).substring(0, 100)}`);
    }
  }

  // Try to fetch the result image
  const first = data?.[0];
  const imageUrl = first?.url || first?.path || (typeof first === 'string' ? first : null);
  console.log(`\n5. Image URL: ${imageUrl}`);

  if (imageUrl) {
    console.log('6. Fetching result image...');
    const imgRes = await fetch(imageUrl);
    console.log(`   Status: ${imgRes.status}, Content-Type: ${imgRes.headers.get('content-type')}`);
    const buf = await imgRes.arrayBuffer();
    console.log(`   Image size: ${buf.byteLength} bytes`);
    console.log('\n✅✅✅ FULL PIPELINE WORKS! Image fetched successfully.');
  } else {
    console.log('\n❌ Could not extract image URL from result');
    console.log('Full data[0]:', JSON.stringify(data?.[0]));
  }

} catch(e) {
  console.error('\n❌ ERROR:', e.message);
}
