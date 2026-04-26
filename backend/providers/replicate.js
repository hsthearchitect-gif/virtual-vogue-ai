import Replicate from 'replicate';
import { base64ToBuffer } from '../utils/imageProcessor.js';

// Use replicate.run() with model name — no hardcoded version hash needed
const MODEL = 'cuuupid/idm-vton';

let client = null;

function getClient() {
  if (!client) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token || token === 'your_replicate_token_here') {
      throw new Error('REPLICATE_API_TOKEN is not configured.');
    }
    client = new Replicate({ auth: token });
    console.log('✅ Replicate client initialized');
  }
  return client;
}

function prepareImageInput(image) {
  if (image && image.startsWith('data:')) {
    return base64ToBuffer(image);
  }
  return image;
}

/**
 * Create prediction using replicate.run() — fires and returns immediately.
 * We wrap it so the background job resolves to output.
 */
export async function createPrediction({ humanImage, garmentImage, garmentDescription, category }) {
  const replicate = getClient();

  console.log('🚀 Creating Replicate prediction via run()...');
  console.log(`   Category: ${category}`);

  // replicate.predictions.create with model (no version) — async job
  const prediction = await replicate.predictions.create({
    model: MODEL,
    input: {
      human_img:   prepareImageInput(humanImage),
      garm_img:    prepareImageInput(garmentImage),
      garment_des: garmentDescription || 'fashionable outfit',
      category:    category || 'upper_body',
      steps:       20,  // Reduced from 30 → faster generation
      seed:        42,
      force_dc:    false,
      mask_only:   false,
    },
  });

  console.log(`✅ Replicate prediction created: ${prediction.id} (${prediction.status})`);

  return {
    predictionId: prediction.id,
    status:       prediction.status,
    output:       prediction.output || null,
  };
}

export async function getPredictionStatus(predictionId) {
  const replicate = getClient();

  try {
    const prediction = await replicate.predictions.get(predictionId);
    console.log(`📊 Replicate ${predictionId}: ${prediction.status}`);

    return {
      status:  prediction.status,
      output:  prediction.output || null,
      error:   prediction.error  || null,
      metrics: prediction.metrics || null,
    };
  } catch (error) {
    console.error(`❌ Replicate status error: ${error.message}`);
    throw new Error(`Failed to check prediction status: ${error.message}`);
  }
}
