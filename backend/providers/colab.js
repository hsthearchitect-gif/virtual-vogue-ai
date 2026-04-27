/**
 * Colab Provider — connects to IDM-VTON running on Google Colab free T4 GPU
 * 
 * Set COLAB_API_URL in Render env vars to the gradio.live URL from Colab.
 * Free, unlimited during session (~12 hours), then re-run the notebook.
 */

import { Client } from '@gradio/client';

export async function runColabTryOn({ humanImage, garmentImage, garmentDescription, category }) {
  const colabUrl = process.env.COLAB_API_URL;
  if (!colabUrl) throw new Error('COLAB_API_URL not set');

  console.log('🔌 Connecting to Colab GPU:', colabUrl);
  const app = await Client.connect(colabUrl);

  const result = await app.predict('/tryon', [
    humanImage,
    garmentImage,
    garmentDescription || 'fashionable outfit',
    category || 'upper_body',
  ]);

  const output = result?.data?.[0];
  if (!output) throw new Error('Colab returned no output');

  // Colab returns base64 directly
  if (typeof output === 'string' && output.startsWith('data:')) return output;
  if (typeof output === 'string' && output.length > 100) return `data:image/jpeg;base64,${output}`;

  throw new Error(`Unexpected Colab output format: ${JSON.stringify(output)?.substring(0, 100)}`);
}
