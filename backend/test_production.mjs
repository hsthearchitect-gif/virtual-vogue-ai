// Full E2E test using the LIVE Render backend (which has HF_TOKEN set)
const BACKEND = 'https://virtual-vogue-ai.onrender.com';

async function imageUrlToBase64(url) {
  const res  = await fetch(url);
  const buf  = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || 'image/jpeg';
  return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
}

console.log('=== Live Production E2E Test ===\n');
console.log('Fetching test images...');

// Use real fashion/person photos
const humanBase64   = await imageUrlToBase64('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=384&h=512&fit=crop');
const garmentBase64 = await imageUrlToBase64('https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=384');

console.log(`Human image:   ${(humanBase64.length/1024).toFixed(0)} KB`);
console.log(`Garment image: ${(garmentBase64.length/1024).toFixed(0)} KB`);

console.log('\nSending to production backend... (this will take 60-120s)\n');

const start = Date.now();

try {
  const res = await fetch(`${BACKEND}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      humanImage:          humanBase64,
      garmentImage:        garmentBase64,
      garmentDescription:  'casual white shirt',
      category:            'upper_body',
    }),
    signal: AbortSignal.timeout(300000), // 5 min
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`Response received in ${elapsed}s`);
  console.log(`HTTP status: ${res.status}`);

  const data = await res.json();
  
  if (data.error) {
    console.error('❌ ERROR from backend:', data.message);
  } else if (data.output?.[0]) {
    const imgData = data.output[0];
    console.log(`✅✅✅ SUCCESS! Image returned: ${(imgData.length/1024).toFixed(0)} KB`);
    console.log(`Elapsed reported by server: ${data.elapsed}`);
    // Save to file so we can verify it
    const b64 = imgData.replace(/^data:image\/\w+;base64,/, '');
    const buf  = Buffer.from(b64, 'base64');
    const { writeFileSync } = await import('fs');
    writeFileSync('test_result.jpg', buf);
    console.log('✅ Saved to test_result.jpg — EVERYTHING WORKING!');
  } else {
    console.log('❌ No output in response:', JSON.stringify(data));
  }
} catch(e) {
  console.error('❌ Request failed:', e.message);
}
