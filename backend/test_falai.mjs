// Test fal.ai IDM-VTON end-to-end
import { fal } from '@fal-ai/client';

const FAL_KEY = process.env.FAL_KEY;

if (!FAL_KEY) {
  console.error('❌ Set FAL_KEY=your_key before running this test');
  process.exit(1);
}

fal.config({ credentials: FAL_KEY });
console.log('✅ fal.ai configured\n');

async function urlToBlob(url) {
  const r = await fetch(url);
  return new Blob([await r.arrayBuffer()], { type: r.headers.get('content-type') });
}

console.log('📤 Uploading test images...');
const humanBlob   = await urlToBlob('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=384&h=512&fit=crop');
const garmentBlob = await urlToBlob('https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=384');

const humanUrl   = await fal.storage.upload(humanBlob);
const garmentUrl = await fal.storage.upload(garmentBlob);
console.log('✅ Uploaded:', humanUrl.substring(0, 60));

console.log('\n🚀 Running IDM-VTON...');
const start = Date.now();

const result = await fal.subscribe('fal-ai/idm-vton', {
  input: {
    human_image_url:    humanUrl,
    garment_image_url:  garmentUrl,
    category:           'tops',
    garment_description: 'casual white shirt',
  },
});

const elapsed = ((Date.now() - start) / 1000).toFixed(1);
const imgUrl = result?.data?.image?.url;
console.log(`\n✅ Done in ${elapsed}s`);
console.log('Image URL:', imgUrl);

if (imgUrl) {
  const r   = await fetch(imgUrl);
  const buf = await r.arrayBuffer();
  const { writeFileSync } = await import('fs');
  writeFileSync('test_falai_result.jpg', Buffer.from(buf));
  console.log(`✅ Saved test_falai_result.jpg (${(buf.byteLength/1024).toFixed(0)} KB)`);
  console.log('\n🎉 FAL.AI WORKS! Deploy with confidence.');
} else {
  console.log('❌ No image URL in result:', JSON.stringify(result?.data));
}
