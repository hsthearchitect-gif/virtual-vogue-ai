import { Client } from '@gradio/client';
import { randomUUID } from 'crypto';

// In-memory store for HF predictions (Gradio calls are synchronous)
const predictions = new Map();

// HF Space for IDM-VTON
const HF_SPACE = 'yisol/IDM-VTON';

/**
 * Create a virtual try-on prediction via Hugging Face Spaces
 * Note: Gradio calls are essentially synchronous (blocking until complete),
 * so we run them in the background and cache results.
 * 
 * @param {Object} input
 * @param {string} input.humanImage - Base64 data URI of the person photo
 * @param {string} input.garmentImage - URL of the garment image
 * @param {string} input.garmentDescription - Text description of the garment
 * @param {string} input.category - "upper_body", "lower_body", or "dresses"
 * @returns {Promise<Object>} { predictionId, status }
 */
export async function createPrediction({ humanImage, garmentImage, garmentDescription, category }) {
  const predictionId = randomUUID();

  console.log('🤗 Creating Hugging Face prediction...');
  console.log(`   Space: ${HF_SPACE}`);
  console.log(`   Prediction ID: ${predictionId}`);

  // Store initial status
  predictions.set(predictionId, {
    status: 'processing',
    output: null,
    error: null,
    createdAt: Date.now(),
  });

  // Run prediction in background (don't await)
  runPrediction(predictionId, { humanImage, garmentImage, garmentDescription, category });

  return {
    predictionId,
    status: 'processing',
    output: null,
  };
}

/**
 * Background prediction runner
 */
async function runPrediction(predictionId, { humanImage, garmentImage, garmentDescription, category }) {
  try {
    const hfToken = process.env.HF_API_TOKEN;
    const connectOptions = hfToken && hfToken !== 'your_hf_token_here'
      ? { hf_token: hfToken }
      : {};

    console.log('🔌 Connecting to HF Space...');
    const app = await Client.connect(HF_SPACE, connectOptions);

    console.log('📤 Sending prediction request to HF Space...');

    // Convert base64 to blob for Gradio
    const humanBlob = base64ToBlob(humanImage);
    const garmentResponse = await fetch(garmentImage);
    const garmentBlob = await garmentResponse.blob();

    const result = await app.predict('/tryon', [
      { background: humanBlob, layers: [], composite: null },  // human image (editor format)
      garmentBlob,                                               // garment image
      garmentDescription || 'fashionable outfit',                // description
      true,                                                       // auto-generated mask
      true,                                                       // auto-crop
      30,                                                         // denoise steps
      0,                                                          // seed
    ]);

    console.log(`✅ HF prediction ${predictionId} succeeded`);

    // Extract output URL from Gradio response
    const outputData = result?.data;
    let outputUrl = null;

    if (outputData && Array.isArray(outputData) && outputData.length > 0) {
      // Gradio returns file objects with url property
      outputUrl = outputData[0]?.url || outputData[0]?.path || outputData[0];
    }

    predictions.set(predictionId, {
      status: 'succeeded',
      output: outputUrl ? [outputUrl] : null,
      error: null,
      completedAt: Date.now(),
    });
  } catch (error) {
    console.error(`❌ HF prediction ${predictionId} failed:`, error.message);

    predictions.set(predictionId, {
      status: 'failed',
      output: null,
      error: error.message,
      completedAt: Date.now(),
    });
  }
}

/**
 * Get the status of an existing prediction
 * @param {string} predictionId
 * @returns {Promise<Object>} { status, output, error }
 */
export async function getPredictionStatus(predictionId) {
  const prediction = predictions.get(predictionId);

  if (!prediction) {
    throw new Error(`Prediction ${predictionId} not found`);
  }

  console.log(`📊 HF Prediction ${predictionId}: ${prediction.status}`);

  return {
    status: prediction.status,
    output: prediction.output,
    error: prediction.error,
  };
}

/**
 * Convert base64 data URI to Blob
 */
function base64ToBlob(base64String) {
  const parts = base64String.split(';base64,');
  const mimeType = parts[0].replace('data:', '');
  const byteCharacters = atob(parts[1]);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

// Cleanup old predictions every 10 minutes
setInterval(() => {
  const TEN_MINUTES = 10 * 60 * 1000;
  const now = Date.now();

  for (const [id, pred] of predictions.entries()) {
    if (now - pred.createdAt > TEN_MINUTES) {
      predictions.delete(id);
    }
  }
}, 10 * 60 * 1000);
