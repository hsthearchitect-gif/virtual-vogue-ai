import { Router } from 'express';
import { compressImage } from '../utils/imageProcessor.js';
import { runWithRotation, getTokenStats } from '../providers/hfMultiToken.js';
import { runTryOn as falTryOn } from '../providers/falai.js';

const router = Router();

const FAL_KEY = process.env.FAL_KEY;

/**
 * POST /api/generate
 *
 * Provider chain:
 *  1. fal.ai  — if FAL_KEY set (unlimited, paid per-generation)
 *  2. HF multi-token rotation — cycles through all HF_TOKENS until one works
 */
router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage)   return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  if (!garmentImage) return res.status(400).json({ error: true, message: 'Please select an outfit.' });

  req.socket.setTimeout(300000);

  try {
    console.log('\n📸 Generation request');
    const stats = getTokenStats();
    console.log(`   Tokens: ${stats.available}/${stats.total} available | FAL: ${FAL_KEY ? '✅' : '❌'}`);

    const compressedHuman = await compressImage(humanImage);

    // ── fal.ai (unlimited, if configured) ─────────────────────────────────
    if (FAL_KEY) {
      try {
        const { base64, elapsed } = await falTryOn({
          humanImage: compressedHuman, garmentImage, garmentDescription, category,
        });
        return res.json({ status: 'succeeded', output: [base64], elapsed, provider: 'fal.ai' });
      } catch (err) {
        console.warn('⚠️ fal.ai failed, falling back to HF:', err.message);
      }
    }

    // ── HF multi-token rotation ────────────────────────────────────────────
    const humanBlob   = base64ToBlob(compressedHuman);
    const garmentBlob = garmentImage.startsWith('data:')
      ? base64ToBlob(garmentImage)
      : await fetch(garmentImage).then(r => r.blob());

    const garmentType = category === 'lower_body' ? 'lower_body'
                      : category === 'dresses'    ? 'dresses'
                      : 'upper_body';

    const start  = Date.now();
    const result = await runWithRotation(humanBlob, garmentBlob, garmentDescription, garmentType);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    const base64 = await extractBase64Image(result?.data);
    if (!base64) throw new Error('No image returned from HuggingFace.');

    console.log(`✅ Done in ${elapsed}s (${(base64.length / 1024).toFixed(0)} KB)`);
    return res.json({ status: 'succeeded', output: [base64], elapsed, provider: 'huggingface' });

  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    return res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/quota  — shows how many tokens are still available today
 */
router.get('/quota', (req, res) => {
  const stats = getTokenStats();
  res.json({
    ...stats,
    estimatedGenerationsLeft: stats.available * 5,
    message: stats.available > 0
      ? `✅ ${stats.available} account(s) available (~${stats.available * 5} generations left today)`
      : '⚠️ All accounts exhausted for today. Resets at midnight UTC.',
  });
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
      try {
        const r   = await fetch(url);
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 1000) {
          const mime = r.headers.get('content-type') || 'image/png';
          return `data:${mime};base64,${Buffer.from(buf).toString('base64')}`;
        }
      } catch (_) {}
    }
    if (item?.data?.length > 100) return `data:${item.mime_type || 'image/png'};base64,${item.data}`;
    if (typeof item === 'string' && item.length > 100 && !item.startsWith('http'))
      return `data:image/png;base64,${item}`;
  }
  return null;
}

export default router;
