import { fal } from '@fal-ai/client';

/**
 * Virtual try-on via fal.ai CatVTON.
 *
 * Requires FAL_KEY env var.
 */

let configured = false;

function ensureConfigured() {
  if (!configured) {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error('FAL_KEY not set in environment variables.');
    fal.config({ credentials: key });
    configured = true;
    console.log('fal.ai client configured');
  }
}

async function uploadBase64Image(base64DataUri) {
  const [header, data] = base64DataUri.split(';base64,');
  const mimeType = header.replace('data:', '');
  const buffer = Buffer.from(data, 'base64');

  const blob = new Blob([buffer], { type: mimeType });
  return await fal.storage.upload(blob);
}

export async function runTryOn({ humanImage, garmentImage, category }) {
  ensureConfigured();

  console.log('Uploading images to fal.ai storage...');

  const humanUrl = await uploadBase64Image(humanImage);
  console.log('  Human image uploaded:', humanUrl.substring(0, 60));

  let garmentBase64 = garmentImage;
  if (!garmentImage.startsWith('data:')) {
    const response = await fetch(garmentImage);
    const buffer = await response.arrayBuffer();
    const mime = response.headers.get('content-type') || 'image/jpeg';
    garmentBase64 = `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
  }

  const garmentUrl = await uploadBase64Image(garmentBase64);
  console.log('  Garment image uploaded:', garmentUrl.substring(0, 60));

  const clothType = category === 'lower_body'
    ? 'lower'
    : category === 'dresses'
      ? 'overall'
      : 'upper';

  console.log(`Running fal.ai CatVTON (cloth_type: ${clothType})...`);
  const start = Date.now();

  const result = await fal.subscribe('fal-ai/cat-vton', {
    input: {
      human_image_url: humanUrl,
      garment_image_url: garmentUrl,
      cloth_type: clothType,
      image_size: 'portrait_4_3',
      num_inference_steps: 30,
      guidance_scale: 2.5,
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === 'IN_PROGRESS') {
        const logs = update.logs?.map((log) => log.message).join(' | ');
        if (logs) console.log('  fal.ai:', logs.substring(0, 100));
      }
    },
  });

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`fal.ai completed in ${elapsed}s`);

  const imageUrl = result?.data?.image?.url;
  if (!imageUrl) {
    throw new Error(`fal.ai returned no image. Response: ${JSON.stringify(result?.data)?.substring(0, 200)}`);
  }

  const imageResponse = await fetch(imageUrl);
  const imageBuffer = await imageResponse.arrayBuffer();
  const mime = imageResponse.headers.get('content-type') || 'image/jpeg';
  const base64 = `data:${mime};base64,${Buffer.from(imageBuffer).toString('base64')}`;

  console.log(`Result image: ${(base64.length / 1024).toFixed(0)} KB`);
  return { base64, elapsed };
}
