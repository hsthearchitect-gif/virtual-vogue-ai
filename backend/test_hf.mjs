import { Client } from '@gradio/client';

console.log('Testing HuggingFace IDM-VTON space directly...\n');

try {
  console.log('Connecting...');
  const app = await Client.connect('yisol/IDM-VTON');
  console.log('Connected!\n');

  // Use real public image URLs
  const humanRes   = await fetch('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=384&h=512&fit=crop');
  const garmentRes = await fetch('https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=384');
  const humanBlob   = await humanRes.blob();
  const garmentBlob = await garmentRes.blob();

  console.log('Sending predict request...');
  const result = await app.predict('/tryon', [
    { background: humanBlob, layers: [], composite: null },
    garmentBlob,
    'casual white shirt',
    true,
    true,
    20,
    42,
  ]);

  console.log('\n=== FULL RESULT ===');
  console.log('result.data type:', typeof result.data);
  console.log('result.data length:', result.data?.length);
  console.log('\nresult.data[0] type:', typeof result.data?.[0]);
  console.log('result.data[0] keys:', Object.keys(result.data?.[0] || {}));
  console.log('result.data[0]:', JSON.stringify(result.data?.[0])?.substring(0, 500));
  console.log('\nresult.data[1] type:', typeof result.data?.[1]);
  console.log('result.data[1]:', JSON.stringify(result.data?.[1])?.substring(0, 200));

} catch(e) {
  console.error('ERROR:', e.message);
  console.error(e.stack);
}
