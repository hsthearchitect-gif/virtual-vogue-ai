import { Router } from 'express';
import * as replicateProvider from '../providers/replicate.js';
import * as huggingfaceProvider from '../providers/huggingface.js';
import { compressImage } from '../utils/imageProcessor.js';

const router = Router();

// Track which provider owns each prediction → ensures polling uses the right one
const predictionProviderMap = new Map(); // predictionId → 'replicate' | 'huggingface'

// Track active requests to prevent duplicates
const activeRequests = new Map();

/**
 * POST /api/generate
 */
router.post('/generate', async (req, res) => {
  const { humanImage, garmentImage, garmentDescription, category } = req.body;

  if (!humanImage) {
    return res.status(400).json({ error: true, message: 'Please upload your photo first.' });
  }
  if (!garmentImage) {
    return res.status(400).json({ error: true, message: 'Please select an outfit.' });
  }

  // Duplicate request check
  const requestKey = `${req.ip}-${category}`;
  if (activeRequests.has(requestKey)) {
    const existing = activeRequests.get(requestKey);
    if (Date.now() - existing.timestamp < 30000) {
      console.log(`🔁 Duplicate request blocked`);
      return res.json({ predictionId: existing.predictionId, status: existing.status });
    }
  }

  try {
    console.log('\n📸 Processing new generation request...');
    const compressedImage = await compressImage(humanImage);

    const input = {
      humanImage:          compressedImage,
      garmentImage,
      garmentDescription:  garmentDescription || 'stylish outfit',
      category:            category || 'upper_body',
    };

    let result = null;
    let usedProvider = null;

    // Go straight to HuggingFace (Replicate account has no credits)
    console.log('🤗 Using HuggingFace provider...');
    result = await huggingfaceProvider.createPrediction(input);
    usedProvider = 'huggingface';
    console.log('✅ HuggingFace prediction started:', result.predictionId);

    // Remember which provider owns this prediction
    predictionProviderMap.set(result.predictionId, usedProvider);
    setTimeout(() => predictionProviderMap.delete(result.predictionId), 30 * 60 * 1000);

    // Track active request
    activeRequests.set(requestKey, {
      predictionId: result.predictionId,
      status:       result.status,
      timestamp:    Date.now(),
    });
    setTimeout(() => activeRequests.delete(requestKey), 5 * 60 * 1000);

    res.json({
      predictionId: result.predictionId,
      status:       result.status,
      provider:     usedProvider,
      output:       result.output || null,
    });

  } catch (error) {
    console.error('❌ Generation error:', error.message);
    res.status(500).json({
      error:   true,
      message: error.message || 'Failed to generate image. Please try again.',
    });
  }
});

/**
 * GET /api/status/:id
 * Polls status using the SAME provider that created the prediction
 */
router.get('/status/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: true, message: 'Prediction ID required.' });

  try {
    // Look up which provider owns this prediction
    const providerName = predictionProviderMap.get(id) || 'huggingface'; // default HF if unknown
    const provider = providerName === 'replicate' ? replicateProvider : huggingfaceProvider;

    console.log(`📊 Checking status for ${id} via ${providerName}`);
    const result = await provider.getPredictionStatus(id);

    res.json({
      predictionId: id,
      status:       result.status,
      output:       result.output,
      error:        result.error,
    });

  } catch (error) {
    console.error(`❌ Status error for ${id}:`, error.message);
    res.status(500).json({
      error:   true,
      message: error.message || 'Failed to check prediction status.',
    });
  }
});

export default router;
