import { Router } from 'express';
import { Client } from '@gradio/client';
import { compressImage } from '../utils/imageProcessor.js';

const router = Router();

// HF token from Render env — required for ZeroGPU quota
const HF_TOKEN = process.env.HF_TOKEN;

/**
 * POST /api/generate
 * Synchronous: waits for HF to finish, returns image as base64.
 */
router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage) return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  if (!garmentImage) return res.status(400).json({ error: true, message: 'Please select an outfit.' });

  if (!HF_TOKEN) {
    return res.status(500).json({
      error: true,
      message: 'HF_TOKEN not configured on server. Add it in Render environment variables.',
    });
  }

  req.socket.setTimeout(300000); // 5-min socket timeout

  try {
    console.log('\n📸 New generation request...');
    console.log(`   Category: ${category}`);
    console.log(`   HF_TOKEN: ${HF_TOKEN ? '✅ set' : '❌ missing'}`);

    // Compress human image
    const compressedHuman = await compressImage(humanImage);
    console.log('✅ Image compressed');

    // Convert images to blobs
    const humanBlob   = base64ToBlob(compressedHuman);
    const garmentBlob = garmentImage.startsWith('data:')
      ? base64ToBlob(garmentImage)
      : await fetch(garmentImage).then(r => r.blob());

    const garmentType = category === 'lower_body' ? 'lower_body'
                      : category === 'dresses'    ? 'dresses'
                      : 'upper_body';

    const startTime = Date.now();
    let result = null;

    // ── Try IDM-VTON first (best quality) ──────────────────────────────────
    try {
      console.log('🔌 Connecting to IDM-VTON...');
      const app = await Client.connect('yisol/IDM-VTON', { hf_token: HF_TOKEN });
      console.log('✅ IDM-VTON connected, running prediction...');

      result = await app.predict('/tryon', [
        { background: humanBlob, layers: [], composite: null },
        garmentBlob,
        garmentDescription || 'fashionable outfit',
        true,   // auto mask
        true,   // auto crop
        20,     // steps (min allowed is 20)
        42,     // seed
      ]);
      console.log('✅ IDM-VTON succeeded');

    } catch (idmErr) {
      console.warn(`⚠️ IDM-VTON failed: ${idmErr.message}`);

      // ── Fallback: Leffa ──────────────────────────────────────────────────
      console.log('🔄 Trying Leffa fallback...');
      const app2 = await Client.connect('franciszzj/Leffa', { hf_token: HF_TOKEN });
      console.log('✅ Leffa connected, running prediction...');

      result = await app2.predict('/leffa_predict_vt', [
        humanBlob,
        garmentBlob,
        true,       // Accelerate UNet
        30,         // Inference Steps
        2.5,        // Guidance Scale
        42,         // Seed
        'viton_hd', // Model Type
        garmentType,// Garment Type
        true,       // Repaint Mode
      ]);
      console.log('✅ Leffa succeeded');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`⏱️ Total time: ${elapsed}s`);
    console.log('📦 Raw output sample:', JSON.stringify(result?.data)?.substring(0, 300));

    // ── Extract output image ──────────────────────────────────────────────
    const outputBase64 = await extractBase64Image(result?.data);

    if (!outputBase64) {
      throw new Error(`No image in response. Raw: ${JSON.stringify(result?.data)?.substring(0, 200)}`);
    }

    console.log(`✅ Image extracted (${(outputBase64.length / 1024).toFixed(0)} KB)`);

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
 * GET /api/status/:id — legacy compat, not used in sync mode
 */
router.get('/status/:id', (req, res) => {
  res.json({ status: 'processing' });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extract base64 image from Gradio response data, handling all known formats
 */
async function extractBase64Image(data) {
  if (!data || !Array.isArray(data) || data.length === 0) return null;

  for (const item of data) {
    if (!item) continue;

    // Format 1: { url: "https://..." }
    const url = item?.url || item?.path;
    if (url && (url.startsWith('http') || url.startsWith('/'))) {
      try {
        const r    = await fetch(url);
        const buf  = await r.arrayBuffer();
        const mime = r.headers.get('content-type') || 'image/png';
        if (buf.byteLength > 1000) { // must be a real image, not error page
          return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch image URL:', e.message);
      }
    }

    // Format 2: { data: "base64string" }
    if (item?.data && typeof item.data === 'string' && item.data.length > 100) {
      const mime = item.mime_type || item.content_type || 'image/png';
      return `data:${mime};base64,${item.data}`;
    }

    // Format 3: plain base64 string
    if (typeof item === 'string' && item.length > 100 && !item.startsWith('http')) {
      return `data:image/png;base64,${item}`;
    }

    // Format 4: plain URL string
    if (typeof item === 'string' && item.startsWith('http')) {
      try {
        const r   = await fetch(item);
        const buf = await r.arrayBuffer();
        const mime = r.headers.get('content-type') || 'image/png';
        if (buf.byteLength > 1000) {
          return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
        }
      } catch (e) {
        console.warn('⚠️ Failed to fetch string URL:', e.message);
      }
    }
  }
  return null;
}

/**
 * Convert base64 data URI to Blob
 */
function base64ToBlob(base64String) {
  const parts     = base64String.split(';base64,');
  const mimeType  = parts[0].replace('data:', '');
  const byteChars = atob(parts[1]);
  const byteArr   = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  return new Blob([byteArr], { type: mimeType });
}

export default router;
