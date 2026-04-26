import * as replicateProvider from './replicate.js';
import * as huggingfaceProvider from './huggingface.js';

/**
 * AI Provider Factory
 * Returns the configured provider based on AI_PROVIDER env variable.
 * Both providers implement the same interface:
 *   - createPrediction(input) → { predictionId, status, output }
 *   - getPredictionStatus(id) → { status, output, error }
 * 
 * This makes it trivial to switch providers by changing one env var.
 */
export function getProvider() {
  const providerName = (process.env.AI_PROVIDER || 'replicate').toLowerCase();

  switch (providerName) {
    case 'replicate':
      console.log('🔧 Using Replicate AI provider');
      return replicateProvider;

    case 'huggingface':
    case 'hf':
      console.log('🔧 Using Hugging Face AI provider');
      return huggingfaceProvider;

    default:
      console.warn(`⚠️ Unknown AI provider "${providerName}", falling back to Replicate`);
      return replicateProvider;
  }
}

/**
 * Try primary provider, fall back to secondary if it fails
 */
export async function createPredictionWithFallback(input) {
  const primaryName = (process.env.AI_PROVIDER || 'replicate').toLowerCase();
  const primary = primaryName === 'huggingface' ? huggingfaceProvider : replicateProvider;
  const fallback = primaryName === 'huggingface' ? replicateProvider : huggingfaceProvider;
  const fallbackName = primaryName === 'huggingface' ? 'Replicate' : 'Hugging Face';

  try {
    return await primary.createPrediction(input);
  } catch (error) {
    console.warn(`⚠️ Primary provider failed: ${error.message}`);
    console.log(`🔄 Attempting fallback to ${fallbackName}...`);

    try {
      return await fallback.createPrediction(input);
    } catch (fallbackError) {
      console.error(`❌ Fallback provider also failed: ${fallbackError.message}`);
      throw new Error(`All AI providers failed. Primary: ${error.message}. Fallback: ${fallbackError.message}`);
    }
  }
}
