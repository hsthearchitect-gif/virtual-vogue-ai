import { Router } from 'express';
import { compressImage } from '../utils/imageProcessor.js';
import { runTryOn as falTryOn } from '../providers/falai.js';
import { runWithRotation, getTokenStats } from '../providers/hfMultiToken.js';
import { runColabTryOn } from '../providers/colab.js';
import { checkTrial, recordUsage, getUsageStats } from '../utils/trialLimiter.js';

const router = Router();

const FAL_KEY   = process.env.FAL_KEY;
const COLAB_URL = process.env.COLAB_API_URL;
const HF_AVAILABLE = !!(process.env.HF_TOKENS || process.env.HF_TOKEN);

/**
 * POST /api/generate
 *
 * Flow:
 *  1. Check trial limit (3/day per IP by default)
 *  2. Try fal.ai if FAL_KEY set
 *  3. Fall back to HF multi-token rotation
 */
router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage)   return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  if (!garmentImage) return res.status(400).json({ error: true, message: 'Please select an outfit.' });

  // ── Trial limit check ────────────────────────────────────────────────────
  const trial = checkTrial(req);
  console.log(`\n📸 Request from ${trial.ip} — trials used: ${trial.used}/${trial.max}`);

  if (!trial.allowed) {
    return res.status(429).json({
      error:   true,
      message: `You've used all ${trial.max} free trials for today. Come back tomorrow for more!`,
      trialsUsed:      trial.used,
      trialsMax:       trial.max,
      trialsRemaining: 0,
      resetsAt:        'midnight UTC',
    });
  }

  req.socket.setTimeout(300000);

  try {
    const compressedHuman = await compressImage(humanImage);
    const startTime = Date.now();
    let base64 = null;
    let provider = null;

    // ── 1. Colab (FREE unlimited GPU — best option when active) ─────────────
    if (COLAB_URL && !base64) {
      try {
        console.log('🧪 Trying Colab GPU...');
        base64   = await runColabTryOn({ humanImage: compressedHuman, garmentImage, garmentDescription, category });
        provider = 'colab';
        console.log('✅ Colab succeeded');
      } catch (err) {
        console.warn('⚠️ Colab failed (session may have expired):', err.message);
      }
    }

    // ── 2. fal.ai (paid, no daily quota) ────────────────────────────────────
    if (FAL_KEY && !base64) {
      try {
        console.log('🚀 Trying fal.ai...');
        const result = await falTryOn({ humanImage: compressedHuman, garmentImage, garmentDescription, category });
        base64   = result.base64;
        provider = 'fal.ai';
      } catch (err) {
        console.warn('⚠️ fal.ai failed:', err.message);
      }
    }

    // ── 3. HuggingFace token rotation (free, ~5 gen/day) ────────────────────
    if (HF_AVAILABLE && !base64) {
      try {
        console.log('🔄 Trying HuggingFace...');
        const humanBlob   = base64ToBlob(compressedHuman);
        const garmentBlob = garmentImage.startsWith('data:')
          ? base64ToBlob(garmentImage)
          : await fetch(garmentImage).then(r => r.blob());

        const garmentType = category === 'lower_body' ? 'lower_body'
                          : category === 'dresses'    ? 'dresses'
                          : 'upper_body';

        const hfResult = await runWithRotation(humanBlob, garmentBlob, garmentDescription, garmentType);
        base64   = await extractBase64Image(hfResult?.data);
        provider = 'huggingface';
      } catch (err) {
        console.warn('⚠️ HuggingFace failed:', err.message);
        throw err; // propagate if both fail
      }
    }

    if (!base64) throw new Error('All AI providers failed. Please try again later.');

    // Record successful usage
    recordUsage(req);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Generated in ${elapsed}s via ${provider} | trials remaining: ${trial.remaining - 1}`);

    return res.json({
      status:          'succeeded',
      output:          [base64],
      elapsed,
      provider,
      trialsUsed:      trial.used + 1,
      trialsMax:       trial.max,
      trialsRemaining: trial.remaining - 1,
    });

  } catch (error) {
    console.error('❌ Generation failed:', error.message);
    return res.status(500).json({ error: true, message: error.message });
  }
});

/**
 * GET /api/quota — live stats for monitoring
 */
router.get('/quota', (req, res) => {
  const trial  = checkTrial(req);
  const hfStats = getTokenStats();
  const usage  = getUsageStats();

  res.json({
    yourTrials: {
      used:      trial.used,
      max:       trial.max,
      remaining: trial.remaining,
    },
    system: {
      hfTokens: hfStats,
      totalGenerationsToday: usage.totalGenerationsToday,
      falKeyConfigured: !!FAL_KEY,
    },
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
          return `data:${r.headers.get('content-type') || 'image/png'};base64,${Buffer.from(buf).toString('base64')}`;
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
