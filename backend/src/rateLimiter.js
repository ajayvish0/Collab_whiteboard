// Token bucket: allows short bursts up to `capacity` events, refilled at
// `ratePerSec`. One bucket per socket connection.
export function createTokenBucket({ capacity, ratePerSec, now = Date.now }) {
  let tokens = capacity;
  let last = now();

  return {
    take(cost = 1) {
      const t = now();
      tokens = Math.min(capacity, tokens + ((t - last) / 1000) * ratePerSec);
      last = t;
      if (tokens < cost) return false;
      tokens -= cost;
      return true;
    },
  };
}
