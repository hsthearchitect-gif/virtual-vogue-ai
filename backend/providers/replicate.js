import Replicate from 'replicate';
import { base64ToBuffer } from '../utils/imageProcessor.js';

let client = null;
let cachedVersionId = null; // Cache the version so we only fetch it once

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

/**
 * Fetch and cache the latest version ID for the model
 */
async function getLatestVersionId() {
  if (cachedVersionId) return cachedVersionId;
  const replicate = getClient();
  const model = await replicate.models.get('cuuupid', 'idm-vton');
  cachedVersionId = model.latest_version?.id;
  console.log(`📌 Using Replicate model version: ${cachedVersionId?.substring(0, 16)}...`);
  return cachedVersionId;
}

function prepareImageInput(image) {
  if (image && image.startsWith('data:')) {
    return base64ToBuffer(image);
  }
  return image;
}

/**
 * Create a new virtual try-on prediction via Replicate
 */
export async function createPrediction({ humanImage, garmentImage, garmentDescription, category }) {
  const replicate = getClient();

  console.log('🚀 Creating Replicate prediction...');
  console.log(`   Category: ${category}`);

  // Get the real version hash (fetched once, then cached)
  const versionId = await getLatestVersionId();
  if (!versionId) throw new Error('Could not find Replicate model version.');

  const prediction = await replicate.predictions.create({
    version: versionId,
    input: {
      human_img:   prepareImageInput(humanImage),
      garm_img:    prepareImageInput(garmentImage),
      garment_des: garmentDescription || 'fashionable outfit',
      category:    category || 'upper_body',
      steps:       20,
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

/**
 * Get the status of an existing prediction
 */
export async function getPredictionStatus(predictionId) {
  const replicate = getClient();
  try {
    const prediction = await replicate.predictions.get(predictionId);
    console.log(`📊 Replicate ${predictionId}: ${prediction.status}`);
    return {
      status:  prediction.status,
      output:  prediction.output || null,
      error:   prediction.error  || null,
    };
  } catch (error) {
    console.error(`❌ Replicate status error: ${error.message}`);
    throw new Error(`Failed to check prediction status: ${error.message}`);
  }
}
