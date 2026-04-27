import { fal } from '@fal-ai/client';

/**
 * Virtual try-on via fal.ai IDM-VTON
 * - No daily quota limits
 * - ~10-15s per generation
 * - Requires FAL_KEY env var (free account at fal.ai)
 */

let configured = false;

function ensureConfigured() {
  if (!configured) {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not set in environment variables.');
    fal.config({ credentials: key });
    configured = true;
    console.log('✅ fal.ai client configured');
  }
}

/**
 * Upload a base64 image to fal.ai storage, return public URL
 */
async function uploadBase64Image(base64DataUri) {
  const [header, data] = base64DataUri.split(';base64,');
  const mimeType = header.replace('data:', '');
  const buffer   = Buffer.from(data, 'base64');

  const blob = new Blob([buffer], { type: mimeType });
  const url  = await fal.storage.upload(blob);
  return url;
}

/**
 * Run virtual try-on synchronously, return base64 result image
 */
export async function runTryOn({ humanImage, garmentImage, garmentDescription, category }) {
  ensureConfigured();

  console.log('📤 Uploading images to fal.ai storage...');

  // Upload human photo
  const humanUrl = await uploadBase64Image(humanImage);
  console.log('  ✅ Human image uploaded:', humanUrl.substring(0, 60));

  // Upload garment image (base64 or convert from URL)
  let garmentBase64 = garmentImage;
  if (!garmentImage.startsWith('data:')) {
    const r    = await fetch(garmentImage);
    const buf  = await r.arrayBuffer();
    const mime = r.headers.get('content-type') || 'image/jpeg';
    garmentBase64 = `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
  }
  const garmentUrl = await uploadBase64Image(garmentBase64);
  console.log('  ✅ Garment image uploaded:', garmentUrl.substring(0, 60));

  const falCategory = category === 'lower_body' ? 'bottoms'
                    : category === 'dresses'    ? 'one-pieces'
                    : 'tops';                          // upper_body → tops

  console.log(`🚀 Running fal.ai IDM-VTON (category: ${falCategory})...`);
  const start = Date.now();

  const result = await fal.subscribe('fal-ai/idm-vton', {
    input: {
      human_image_url:   humanUrl,
      garment_image_url: garmentUrl,
      category:          falCategory,
      garment_description: garmentDescription || 'fashionable outfit',
      restore_background: false,
      restore_clothes:    false,
      flat_lay:           false,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        const logs = update.logs?.map(l => l.message).join(' | ');
        if (logs) console.log('  fal.ai:', logs.substring(0, 100));
      }
    },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`✅ fal.ai completed in ${elapsed}s`);

  const imageUrl = result?.data?.image?.url;
  if (!imageUrl) {
    throw new Error(`fal.ai returned no image. Response: ${JSON.stringify(result?.data)?.substring(0, 200)}`);
  }

  // Fetch and convert to base64 for frontend
  const imgRes  = await fetch(imageUrl);
  const imgBuf  = await imgRes.arrayBuffer();
  const mime    = imgRes.headers.get('content-type') || 'image/jpeg';
  const base64  = `data:${mime};base64,${Buffer.from(imgBuf).toString('base64')}`;

  console.log(`✅ Result image: ${(base64.length / 1024).toFixed(0)} KB`);
  return { base64, elapsed };
}
