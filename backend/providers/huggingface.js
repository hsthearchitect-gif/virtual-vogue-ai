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

    // Handle garment: base64 data URI → Blob, or fetch from URL
    const humanBlob = base64ToBlob(humanImage);
    let garmentBlob;
    if (garmentImage.startsWith('data:')) {
      garmentBlob = base64ToBlob(garmentImage);
    } else {
      const garmentResponse = await fetch(garmentImage);
      garmentBlob = await garmentResponse.blob();
    }

    const result = await app.predict('/tryon', [
      { background: humanBlob, layers: [], composite: null },
      garmentBlob,
      garmentDescription || 'fashionable outfit',
      true,
      true,
      15,   // Reduced 30 → 15: halves GPU time with minimal quality loss
      42,
    ]);

    console.log(`✅ HF prediction ${predictionId} succeeded`);
    console.log('📦 Raw HF output:', JSON.stringify(result?.data)?.substring(0, 300));

    // Extract output from Gradio response
    const outputData = result?.data;
    let outputBase64 = null;

    if (outputData && Array.isArray(outputData) && outputData.length > 0) {
      const first = outputData[0];

      // Gradio can return: { url, path }, a string URL, or raw base64
      let imageUrl = first?.url || first?.path || (typeof first === 'string' ? first : null);

      if (imageUrl) {
        console.log('🌐 Fetching image from HF URL:', imageUrl.substring(0, 80));
        // Fetch and convert to base64 so CORS is not an issue on the frontend
        const imgRes = await fetch(imageUrl);
        const imgBuf = await imgRes.arrayBuffer();
        const mime   = imgRes.headers.get('content-type') || 'image/png';
        outputBase64 = `data:${mime};base64,${Buffer.from(imgBuf).toString('base64')}`;
        console.log('✅ Image converted to base64, size:', outputBase64.length);
      } else if (first?.data) {
        // Some Gradio versions return {data: 'base64...'}
        outputBase64 = `data:image/png;base64,${first.data}`;
      }
    }

    predictions.set(predictionId, {
      status: 'succeeded',
      output: outputBase64 ? [outputBase64] : null,
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

  // If not found (e.g. server restarted), return processing so frontend keeps waiting
  if (!prediction) {
    console.warn(`⚠️ Prediction ${predictionId} not in memory (server may have restarted)`);
    return { status: 'processing', output: null, error: null };
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
