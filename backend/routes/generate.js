import { Router } from 'express';
import { Client } from '@gradio/client';
import { compressImage } from '../utils/imageProcessor.js';
import { runTryOn as falTryOn } from '../providers/falai.js';

const router = Router();

const HF_TOKEN  = process.env.HF_TOKEN;
const FAL_KEY   = process.env.FAL_KEY;

/**
 * POST /api/generate
 *
 * Provider priority:
 *  1. fal.ai  — if FAL_KEY is set (no quota, ~10-15s, recommended)
 *  2. HuggingFace IDM-VTON — if HF_TOKEN is set (100 GPU-sec/day free)
 *  3. HuggingFace Leffa — fallback
 */
router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage)   return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  if (!garmentImage) return res.status(400).json({ error: true, message: 'Please select an outfit.' });

  req.socket.setTimeout(300000);

  try {
    console.log('\n📸 Generation request received');
    console.log(`   Category: ${category}`);
    console.log(`   FAL_KEY:  ${FAL_KEY  ? '✅' : '❌'} | HF_TOKEN: ${HF_TOKEN ? '✅' : '❌'}`);

    const compressedHuman = await compressImage(humanImage);

    // ── Provider 1: fal.ai (unlimited, fast) ────────────────────────────────
    if (FAL_KEY) {
      try {
        console.log('\n🚀 Using fal.ai provider...');
        const { base64, elapsed } = await falTryOn({
          humanImage:         compressedHuman,
          garmentImage,
          garmentDescription,
          category,
        });
        console.log(`\n✅ fal.ai succeeded in ${elapsed}s`);
        return res.json({ status: 'succeeded', output: [base64], elapsed, provider: 'fal.ai' });
      } catch (falErr) {
        console.warn(`⚠️ fal.ai failed: ${falErr.message}`);
        console.log('🔄 Falling back to HuggingFace...');
      }
    }

    // ── Provider 2+3: HuggingFace (with token auth) ─────────────────────────
    if (!HF_TOKEN) {
      return res.status(500).json({
        error: true,
        message: 'No AI provider configured. Please set FAL_KEY or HF_TOKEN in environment variables.',
      });
    }

    const humanBlob   = base64ToBlob(compressedHuman);
    const garmentBlob = garmentImage.startsWith('data:')
      ? base64ToBlob(garmentImage)
      : await fetch(garmentImage).then(r => r.blob());

    const garmentType = category === 'lower_body' ? 'lower_body'
                      : category === 'dresses'    ? 'dresses'
                      : 'upper_body';

    const startTime = Date.now();
    let result = null;

    // Try IDM-VTON
    try {
      console.log('\n🔌 Connecting to IDM-VTON...');
      const app = await Client.connect('yisol/IDM-VTON', { hf_token: HF_TOKEN });
      result = await app.predict('/tryon', [
        { background: humanBlob, layers: [], composite: null },
        garmentBlob,
        garmentDescription || 'fashionable outfit',
        true, true, 20, 42,
      ]);
      console.log('✅ IDM-VTON succeeded');
    } catch (idmErr) {
      console.warn(`⚠️ IDM-VTON failed: ${idmErr.message}`);

      // Try Leffa
      console.log('🔄 Trying Leffa...');
      const app2 = await Client.connect('franciszzj/Leffa', { hf_token: HF_TOKEN });
      result = await app2.predict('/leffa_predict_vt', [
        humanBlob, garmentBlob,
        true, 30, 2.5, 42, 'viton_hd', garmentType, true,
      ]);
      console.log('✅ Leffa succeeded');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const base64  = await extractBase64Image(result?.data);

    if (!base64) throw new Error(`No image in HF response: ${JSON.stringify(result?.data)?.substring(0, 200)}`);

    console.log(`✅ HF completed in ${elapsed}s (${(base64.length / 1024).toFixed(0)} KB)`);
    return res.json({ status: 'succeeded', output: [base64], elapsed, provider: 'huggingface' });

  } catch (error) {
    console.error('\n❌ Generation failed:', error.message);
    return res.status(500).json({ error: true, message: error.message });
  }
});

router.get('/status/:id', (_req, res) => res.json({ status: 'processing' }));

// ─── Helpers ────────────────────────────────────────────────────────────────

function base64ToBlob(base64String) {
  const parts     = base64String.split(';base64,');
  const mimeType  = parts[0].replace('data:', '');
  const byteChars = atob(parts[1]);
  const byteArr   = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
  return new Blob([byteArr], { type: mimeType });
}

async function extractBase64Image(data) {
  if (!data || !Array.isArray(data)) return null;
  for (const item of data) {
    const url = item?.url || item?.path;
    if (url?.startsWith('http')) {
      const r   = await fetch(url);
      const buf = await r.arrayBuffer();
      if (buf.byteLength > 1000) {
        const mime = r.headers.get('content-type') || 'image/png';
        return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
      }
    }
    if (item?.data?.length > 100) return `data:${item.mime_type || 'image/png'};base64,${item.data}`;
    if (typeof item === 'string' && item.length > 100 && !item.startsWith('http')) return `data:image/png;base64,${item}`;
  }
  return null;
}

export default router;
