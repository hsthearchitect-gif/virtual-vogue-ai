/**
 * HuggingFace Multi-Token Manager
 * 
 * Rotates through multiple HF tokens to multiply the free ZeroGPU quota.
 * Each free account = ~100 GPU-sec/day = ~5 generations/day
 * 5 accounts = ~25 generations/day → supports ~100 daily users (25% conversion)
 * 
 * Set env var: HF_TOKENS=hf_token1,hf_token2,hf_token3,...
 * Falls back to HF_TOKEN if HF_TOKENS not set.
 */

import { Client } from '@gradio/client';

// Load all tokens from comma-separated env var
function loadTokens() {
  const multi  = process.env.HF_TOKENS || '';
  const single = process.env.HF_TOKEN  || '';
  const list   = multi.split(',').map(t => t.trim()).filter(Boolean);
  if (single && !list.includes(single)) list.push(single);
  return list;
}

const tokens = loadTokens();
let currentIndex = 0;

// Track exhausted tokens, reset at midnight UTC
const exhaustedTokens = new Set();
let lastReset = new Date().toDateString();

function checkDailyReset() {
  const today = new Date().toDateString();
  if (today !== lastReset) {
    exhaustedTokens.clear();
    lastReset = today;
    console.log('🔄 Midnight reset: all HF token quotas refreshed');
  }
}

function getNextToken() {
  checkDailyReset();
  const available = tokens.filter((_, i) => !exhaustedTokens.has(i));
  if (available.length === 0) return null;

  // Rotate through available tokens
  while (exhaustedTokens.has(currentIndex)) {
    currentIndex = (currentIndex + 1) % tokens.length;
  }
  const token = tokens[currentIndex];
  currentIndex = (currentIndex + 1) % tokens.length;
  return { token, index: tokens.indexOf(token) };
}

function markExhausted(index) {
  exhaustedTokens.add(index);
  console.log(`⚠️ Token ${index + 1}/${tokens.length} quota exhausted. ${tokens.length - exhaustedTokens.size} tokens remaining today.`);
}

function isQuotaError(msg) {
  return msg.includes('quota') || msg.includes('ZeroGPU') || msg.includes('exceeded');
}

/**
 * Run IDM-VTON with automatic token rotation on quota errors
 */
export async function runWithRotation(humanBlob, garmentBlob, garmentDescription, garmentType) {
  if (tokens.length === 0) throw new Error('No HF tokens configured. Set HF_TOKENS or HF_TOKEN env var.');

  checkDailyReset();
  console.log(`🔑 HF Tokens available: ${tokens.length - exhaustedTokens.size}/${tokens.length}`);

  // Try each token until one works
  for (let attempt = 0; attempt < tokens.length; attempt++) {
    const next = getNextToken();
    if (!next) break;

    const { token, index } = next;
    console.log(`   Trying token ${index + 1}/${tokens.length}...`);

    try {
      // Try IDM-VTON first
      const result = await tryIDMVTON(token, humanBlob, garmentBlob, garmentDescription, garmentType);
      console.log(`✅ Success with token ${index + 1}`);
      return result;
    } catch (err) {
      if (isQuotaError(err.message)) {
        markExhausted(index);
        console.log(`   Trying next token...`);
        continue; // Try next token
      }
      // Non-quota error — try Leffa with same token
      console.warn(`   IDM-VTON error (not quota): ${err.message}`);
      try {
        const result = await tryLeffa(token, humanBlob, garmentBlob, garmentType);
        console.log(`✅ Leffa succeeded with token ${index + 1}`);
        return result;
      } catch (leffaErr) {
        if (isQuotaError(leffaErr.message)) {
          markExhausted(index);
          continue;
        }
        throw leffaErr; // Real error, propagate
      }
    }
  }

  const resetTime = new Date();
  resetTime.setUTCHours(24, 0, 0, 0);
  const hoursLeft = Math.ceil((resetTime - Date.now()) / 3600000);

  throw new Error(
    `All HF accounts have reached their daily GPU quota. ` +
    `Resets in ~${hoursLeft} hour(s) (midnight UTC). ` +
    `Add more HF tokens via HF_TOKENS env var to increase capacity.`
  );
}

async function tryIDMVTON(token, humanBlob, garmentBlob, garmentDescription, garmentType) {
  const app = await Client.connect('yisol/IDM-VTON', { hf_token: token });
  return await app.predict('/tryon', [
    { background: humanBlob, layers: [], composite: null },
    garmentBlob,
    garmentDescription || 'fashionable outfit',
    true, true, 20, 42,
  ]);
}

async function tryLeffa(token, humanBlob, garmentBlob, garmentType) {
  const app = await Client.connect('franciszzj/Leffa', { hf_token: token });
  return await app.predict('/leffa_predict_vt', [
    humanBlob, garmentBlob,
    true, 30, 2.5, 42,
    'viton_hd', garmentType, true,
  ]);
}

export function getTokenStats() {
  checkDailyReset();
  return {
    total:     tokens.length,
    available: tokens.length - exhaustedTokens.size,
    exhausted: exhaustedTokens.size,
  };
}
