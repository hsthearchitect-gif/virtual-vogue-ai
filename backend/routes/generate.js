import { Router } from 'express';
import { compressImage } from '../utils/imageProcessor.js';
import { runTryOn as falTryOn } from '../providers/falai.js';
import { runWithRotation, getTokenStats } from '../providers/hfMultiToken.js';
import { runColabTryOn } from '../providers/colab.js';
import { checkTrial, recordUsage, getUsageStats } from '../utils/trialLimiter.js';

const router = Router();

const FAL_KEY = process.env.FAL_KEY;
const COLAB_URL = process.env.COLAB_API_URL;
const HF_AVAILABLE = !!(process.env.HF_TOKENS || process.env.HF_TOKEN);

router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage) return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  if (!garmentImage) return res.status(400).json({ error: true, message: 'Please select an outfit.' });

  const trial = checkTrial(req);
  console.log(`\nRequest from ${trial.ip} - trials used: ${trial.used}/${trial.max}`);

  if (!trial.allowed) {
    return res.status(429).json({
      error: true,
      code: 'TRIAL_LIMIT_REACHED',
      message: `You've used all ${trial.max} free trials for today. Come back tomorrow for more!`,
      trialsUsed: trial.used,
      trialsMax: trial.max,
      trialsRemaining: 0,
      resetsAt: 'midnight UTC',
    });
  }

  req.socket.setTimeout(300000);

  try {
    const compressedHuman = await compressImage(humanImage);
    const startTime = Date.now();
    let base64 = null;
    let provider = null;
    let falError = null;

    if (COLAB_URL && !base64) {
      try {
        console.log('Trying Colab GPU...');
        base64 = await runColabTryOn({ humanImage: compressedHuman, garmentImage, garmentDescription, category });
        provider = 'colab';
        console.log('Colab succeeded');
      } catch (err) {
        console.warn('Colab failed:', err.message);
      }
    }

    if (FAL_KEY && !base64) {
      try {
        console.log('Trying fal.ai...');
        const result = await falTryOn({ humanImage: compressedHuman, garmentImage, garmentDescription, category });
        base64 = result.base64;
        provider = 'fal.ai';
      } catch (err) {
        console.warn('fal.ai failed:', err.message);
        falError = err;
      }
    }

    if (HF_AVAILABLE && !base64) {
      try {
        console.log('Trying HuggingFace...');
        const humanBlob = base64ToBlob(compressedHuman);
        const garmentBlob = garmentImage.startsWith('data:')
          ? base64ToBlob(garmentImage)
          : await fetch(garmentImage).then((response) => response.blob());

        const garmentType = category === 'lower_body'
          ? 'lower_body'
          : category === 'dresses'
            ? 'dresses'
            : 'upper_body';

        const hfResult = await runWithRotation(humanBlob, garmentBlob, garmentDescription, garmentType);
        base64 = await extractBase64Image(hfResult?.data);
        provider = 'huggingface';
      } catch (err) {
        console.warn('HuggingFace failed:', err.message);
        if (falError) {
          throw new Error(`fal.ai provider failed before HuggingFace fallback: ${falError.message}`);
        }
        throw err;
      }
    }

    if (!base64) {
      if (falError) throw new Error(`fal.ai provider failed: ${falError.message}`);
      throw new Error('All AI providers failed. Please try again later.');
    }

    recordUsage(req);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Generated in ${elapsed}s via ${provider} | trials remaining: ${trial.remaining - 1}`);

    return res.json({
      status: 'succeeded',
      output: [base64],
      elapsed,
      provider,
      trialsUsed: trial.used + 1,
      trialsMax: trial.max,
      trialsRemaining: trial.remaining - 1,
    });
  } catch (error) {
    console.error('Generation failed:', error.message);
    const classified = classifyGenerationError(error);
    return res.status(classified.status).json({
      error: true,
      code: classified.code,
      message: classified.message,
    });
  }
});

router.get('/quota', (req, res) => {
  const trial = checkTrial(req);
  const hfStats = getTokenStats();
  const usage = getUsageStats();

  res.json({
    yourTrials: {
      used: trial.used,
      max: trial.max,
      remaining: trial.remaining,
    },
    system: {
      hfTokens: hfStats,
      totalGenerationsToday: usage.totalGenerationsToday,
      colabConfigured: !!COLAB_URL,
      falKeyConfigured: !!FAL_KEY,
    },
  });
});

router.get('/status/:id', (_req, res) => res.json({ status: 'processing' }));

function base64ToBlob(base64String) {
  const parts = base64String.split(';base64,');
  const mimeType = parts[0].replace('data:', '');
  const byteChars = atob(parts[1]);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  return new Blob([byteArray], { type: mimeType });
}

async function extractBase64Image(data) {
  if (!data || !Array.isArray(data)) return null;

  for (const item of data) {
    const url = item?.url || item?.path;

    if (url?.startsWith('http')) {
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength > 1000) {
          return `data:${response.headers.get('content-type') || 'image/png'};base64,${Buffer.from(buffer).toString('base64')}`;
        }
      } catch (_) {}
    }

    if (item?.data?.length > 100) return `data:${item.mime_type || 'image/png'};base64,${item.data}`;
    if (typeof item === 'string' && item.length > 100 && !item.startsWith('http')) {
      return `data:image/png;base64,${item}`;
    }
  }

  return null;
}

function classifyGenerationError(error) {
  const rawMessage = error?.message || 'Generation failed. Please try again later.';
  const normalized = rawMessage.toLowerCase();

  if (normalized.includes('fal.ai provider failed') || normalized.includes('fal_key')) {
    return {
      status: 502,
      code: 'FAL_PROVIDER_FAILED',
      message:
        'fal.ai is configured, but the provider request failed. Check the FAL_KEY value, fal.ai account credits, and backend logs.',
    };
  }

  if (
    normalized.includes('zerogpu') ||
    normalized.includes('gpu quota') ||
    normalized.includes('daily gpu quota') ||
    normalized.includes('quota') ||
    normalized.includes('exceeded')
  ) {
    return {
      status: 503,
      code: 'PROVIDER_QUOTA_EXHAUSTED',
      message:
        'AI generation capacity is temporarily exhausted on the free provider. Start the Colab GPU notebook or configure FAL_KEY on the backend to keep try-ons available.',
    };
  }

  if (normalized.includes('no hf tokens configured')) {
    return {
      status: 503,
      code: 'NO_PROVIDER_CONFIGURED',
      message:
        'No active AI provider is configured. Add COLAB_API_URL, FAL_KEY, or HF_TOKENS on the backend.',
    };
  }

  if (normalized.includes('all ai providers failed')) {
    return {
      status: 503,
      code: 'ALL_PROVIDERS_FAILED',
      message:
        'All AI providers are unavailable right now. Check the Colab session, fal.ai key, or Hugging Face token quota.',
    };
  }

  return {
    status: 500,
    code: 'GENERATION_FAILED',
    message: rawMessage,
  };
}

export default router;
