/**
 * Trial Usage Limiter
 * 
 * Limits each IP to MAX_TRIALS_PER_DAY generations per day.
 * Resets at midnight UTC.
 * Stored in memory (resets on server restart — acceptable for demo).
 */

const MAX_TRIALS_PER_DAY = parseInt(process.env.MAX_TRIALS_PER_DAY || '3');

// Map: IP → { count, date }
const usageMap = new Map();

function getTodayUTC() {
  return new Date().toISOString().split('T')[0]; // "2026-04-27"
}

function getCleanIP(req) {
  // Handle Render's reverse proxy
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip;
  return ip || 'unknown';
}

/**
 * Check if an IP has trials remaining.
 * Returns { allowed: bool, used: number, max: number, remaining: number }
 */
export function checkTrial(req) {
  const ip    = getCleanIP(req);
  const today = getTodayUTC();
  const entry = usageMap.get(ip);

  // New day or new IP — reset/create
  if (!entry || entry.date !== today) {
    usageMap.set(ip, { count: 0, date: today });
    return { allowed: true, used: 0, max: MAX_TRIALS_PER_DAY, remaining: MAX_TRIALS_PER_DAY, ip };
  }

  const remaining = MAX_TRIALS_PER_DAY - entry.count;
  return {
    allowed:   remaining > 0,
    used:      entry.count,
    max:       MAX_TRIALS_PER_DAY,
    remaining: Math.max(0, remaining),
    ip,
  };
}

/**
 * Record a generation use for an IP
 */
export function recordUsage(req) {
  const ip    = getCleanIP(req);
  const today = getTodayUTC();
  const entry = usageMap.get(ip) || { count: 0, date: today };
  entry.count += 1;
  entry.date   = today;
  usageMap.set(ip, entry);
  console.log(`📊 Usage: IP ${ip} → ${entry.count}/${MAX_TRIALS_PER_DAY} today`);
}

/**
 * Get global stats (for /api/quota endpoint)
 */
export function getUsageStats() {
  const today   = getTodayUTC();
  let totalToday = 0;
  for (const [, entry] of usageMap) {
    if (entry.date === today) totalToday += entry.count;
  }
  return { totalGenerationsToday: totalToday, maxPerUser: MAX_TRIALS_PER_DAY };
}
