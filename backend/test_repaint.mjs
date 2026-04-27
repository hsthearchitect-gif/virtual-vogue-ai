import { Client } from '@gradio/client';

const app = await Client.connect('franciszzj/Leffa');

const humanRes   = await fetch('https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=384&h=512&fit=crop');
const garmentRes = await fetch('https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=384');
const humanBlob   = await humanRes.blob();
const garmentBlob = await garmentRes.blob();

// Try different repaint mode values
const repaints = [true, false, 'True', 'False', 'repaint', 'no repaint'];

for (const repaint of repaints) {
  console.log(`Testing Repaint Mode: ${JSON.stringify(repaint)}`);
  try {
    const result = await app.predict('/leffa_predict_vt', [
      humanBlob, garmentBlob,
      true, 30, 2.5, 42, 'viton_hd', 'upper_body', repaint
    ]);
    console.log(`✅ SUCCESS with repaint=${JSON.stringify(repaint)}!`);
    console.log('Output data[0]:', JSON.stringify(result.data?.[0])?.substring(0, 200));
    break;
  } catch(e) {
    console.log(`❌ ${e.message.substring(0, 100)}`);
  }
}
