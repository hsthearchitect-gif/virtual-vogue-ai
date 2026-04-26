import Replicate from 'replicate';
import { base64ToBuffer } from '../utils/imageProcessor.js';

// Use model name only — no hardcoded version hash (always uses latest)
const MODEL = 'cuuupid/idm-vton';

let client = null;

function getClient() {
  if (!client) {
    const token = process.env.REPLICATE_API_TOKEN;
    if (!token || token === 'your_replicate_token_here') {
      throw new Error('REPLICATE_API_TOKEN is not configured. Get one at https://replicate.com/account');
    }
    client = new Replicate({ auth: token });
    console.log('✅ Replicate client initialized');
  }
  return client;
}

/**
 * Convert input to something Replicate can consume.
 * - If it's a base64 data URI → convert to Buffer (Replicate SDK auto-uploads it)
 * - If it's a public URL → pass through as-is
 */
function prepareImageInput(image) {
  if (image && image.startsWith('data:')) {
    return base64ToBuffer(image);
  }
  return image;
}

/**
 * Create a new virtual try-on prediction
 */
export async function createPrediction({ humanImage, garmentImage, garmentDescription, category }) {
  const replicate = getClient();

  console.log('🚀 Creating Replicate prediction...');
  console.log(`   Model: ${MODEL}`);
  console.log(`   Category: ${category}`);
  console.log(`   Description: ${garmentDescription}`);
  console.log(`   Human image: ${humanImage?.substring(0, 40)}...`);
  console.log(`   Garment image: ${typeof garmentImage === 'object' ? '[Buffer]' : garmentImage?.substring(0, 40)}`);

  try {
    const humanImgInput  = prepareImageInput(humanImage);
    const garmentImgInput = prepareImageInput(garmentImage);

    const prediction = await replicate.predictions.create({
      model: MODEL,
      input: {
        human_img:   humanImgInput,
        garm_img:    garmentImgInput,
        garment_des: garmentDescription || 'fashionable outfit',
        category:    category || 'upper_body',
        steps:       30,
        seed:        42,
        force_dc:    false,
        mask_only:   false,
      },
    });

    console.log(`✅ Prediction created: ${prediction.id} (status: ${prediction.status})`);

    return {
      predictionId: prediction.id,
      status:       prediction.status,
      output:       prediction.output || null,
    };
  } catch (error) {
    console.error('❌ Replicate prediction failed:', error.message);

    if (error.message.includes('authentication') || error.message.includes('token') || error.message.includes('401')) {
      throw new Error('Invalid Replicate API token. Check your .env file.');
    }
    if (error.message.includes('rate') || error.message.includes('limit') || error.message.includes('429')) {
      throw new Error('Replicate rate limit reached. Please try again in a few minutes.');
    }
    if (error.message.includes('billing') || error.message.includes('payment') || error.message.includes('402')) {
      throw new Error('Replicate billing issue. Please check your account at replicate.com.');
    }

    throw new Error(`AI generation failed: ${error.message}`);
  }
}

/**
 * Get the status of an existing prediction
 */
export async function getPredictionStatus(predictionId) {
  const replicate = getClient();

  try {
    const prediction = await replicate.predictions.get(predictionId);
    console.log(`📊 Prediction ${predictionId}: ${prediction.status}`);

    return {
      status:  prediction.status,
      output:  prediction.output || null,
      error:   prediction.error  || null,
      metrics: prediction.metrics || null,
    };
  } catch (error) {
    console.error(`❌ Failed to get prediction status: ${error.message}`);
    throw new Error(`Failed to check prediction status: ${error.message}`);
  }
}
