/**
 * In-Memory Sliding Window Rate Limiter for Next.js API Routes
 */

const tracker = new Map();

// Periodic cleanup every 5 minutes to prevent memory leaks
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of tracker.entries()) {
    if (now - record.windowStart > record.windowMs * 2) {
      tracker.delete(key);
    }
  }
}, 300000);

if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Get client IP address from Next.js request headers
 */
export function getClientIp(req) {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return '127.0.0.1';
}

/**
 * Check if the request is within rate limits
 * @param {Request} req - Next.js Request object
 * @param {Object} options
 * @param {number} options.limit - Max requests in window
 * @param {number} options.windowMs - Window duration in milliseconds (default 1 minute)
 * @param {string} options.keyPrefix - Prefix to separate different endpoints
 * @returns {{ allowed: boolean, remaining: number, resetSeconds: number }}
 */
export function checkRateLimit(req, { limit = 20, windowMs = 60000, keyPrefix = 'global' } = {}) {
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();

  let record = tracker.get(key);

  if (!record || now - record.windowStart > windowMs) {
    // New window
    record = {
      windowStart: now,
      windowMs,
      count: 1
    };
    tracker.set(key, record);
    return {
      allowed: true,
      remaining: limit - 1,
      resetSeconds: Math.ceil(windowMs / 1000)
    };
  }

  record.count += 1;
  const remaining = Math.max(0, limit - record.count);
  const resetSeconds = Math.ceil((record.windowStart + windowMs - now) / 1000);

  if (record.count > limit) {
    return {
      allowed: false,
      remaining: 0,
      resetSeconds
    };
  }

  return {
    allowed: true,
    remaining,
    resetSeconds
  };
}

/**
 * Utility to escape regex special characters to prevent ReDoS / Regex Injection
 */
export function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
