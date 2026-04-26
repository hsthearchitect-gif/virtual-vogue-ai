import { Router } from 'express';
import { Client } from '@gradio/client';
import { compressImage } from '../utils/imageProcessor.js';

const router = Router();

/**
 * POST /api/generate
 * 
 * SYNCHRONOUS architecture: waits for HuggingFace to finish and returns
 * the result image directly as base64. No polling needed.
 * Timeout: 4 minutes (HF free tier takes 60-120s typically).
 */
router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage) return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  if (!garmentImage) return res.status(400).json({ error: true, message: 'Please select an outfit.' });

  // Extend socket timeout for long-running HF requests (4 min)
  req.socket.setTimeout(240000);

  try {
    console.log('\n📸 New generation request — running synchronously...');
    console.log(`   Category: ${category}`);

    // Compress human image
    const compressedHuman = await compressImage(humanImage);
    console.log('✅ Image compressed');

    // Connect to Leffa space (no ZeroGPU quota restrictions)
    console.log('🔌 Connecting to Leffa virtual try-on space...');
    const app = await Client.connect('franciszzj/Leffa');
    console.log('✅ Connected');

    // Convert images to blobs
    const humanBlob   = base64ToBlob(compressedHuman);
    const garmentBlob = garmentImage.startsWith('data:')
      ? base64ToBlob(garmentImage)
      : await fetch(garmentImage).then(r => r.blob());

    console.log('🚀 Sending to Leffa — waiting for result...');
    const startTime = Date.now();

    // Leffa /leffa_predict_vt inputs:
    // Person Image, Garment Image, Accelerate UNet (bool), Steps, Guidance Scale, Seed, Model Type, Garment Type, Repaint Mode
    const garmentType = category === 'lower_body' ? 'lower_body' : category === 'dresses' ? 'dresses' : 'upper_body';

    const result = await app.predict('/leffa_predict_vt', [
      humanBlob,          // Person Image
      garmentBlob,        // Garment Image
      true,               // Accelerate UNet
      30,                 // Inference Steps
      2.5,                // Guidance Scale
      42,                 // Seed
      'viton_hd',         // Model Type
      garmentType,        // Garment Type
      'image',            // Repaint Mode
    ]);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ HuggingFace completed in ${elapsed}s`);
    console.log('📦 Raw output:', JSON.stringify(result?.data)?.substring(0, 200));

    // Extract and convert output image to base64 (avoids CORS on frontend)
    const outputData = result?.data;
    let outputBase64 = null;

    if (outputData && Array.isArray(outputData) && outputData.length > 0) {
      const first = outputData[0];
      const imageUrl = first?.url || first?.path || (typeof first === 'string' ? first : null);

      if (imageUrl) {
        console.log('🌐 Fetching result image from HF URL...');
        const imgRes  = await fetch(imageUrl);
        const imgBuf  = await imgRes.arrayBuffer();
        const mime    = imgRes.headers.get('content-type') || 'image/png';
        outputBase64  = `data:${mime};base64,${Buffer.from(imgBuf).toString('base64')}`;
        console.log(`✅ Image ready (${(outputBase64.length / 1024).toFixed(0)} KB)`);
      } else if (first?.data) {
        outputBase64 = `data:image/png;base64,${first.data}`;
      }
    }

    if (!outputBase64) {
      throw new Error('HuggingFace returned no output image. Please try again.');
    }

    // Return the result directly — no polling needed!
    return res.json({
      status:  'succeeded',
      output:  [outputBase64],
      elapsed: `${elapsed}s`,
    });

  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    return res.status(500).json({
      error:   true,
      message: error.message || 'Generation failed. Please try again.',
    });
  }
});

/**
 * GET /api/status/:id — kept for backwards compat but not used anymore
 */
router.get('/status/:id', (req, res) => {
  res.json({ status: 'processing', message: 'Using synchronous mode — no polling needed.' });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function base64ToBlob(base64String) {
  const parts      = base64String.split(';base64,');
  const mimeType   = parts[0].replace('data:', '');
  const byteChars  = atob(parts[1]);
  const byteArr    = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  return new Blob([byteArr], { type: mimeType });
}

export default router;
