import { RateLimiterMemory } from 'rate-limiter-flexible';

// Max 5 moves/sec per socket (prevents move flooding)
export const moveRateLimiter = new RateLimiterMemory({
  points: 5,
  duration: 1,
});

// Max 2 chat messages/sec per socket
export const chatRateLimiter = new RateLimiterMemory({
  points: 2,
  duration: 1,
});

// Max 10 general actions/sec (draw, resign, ping)
export const actionRateLimiter = new RateLimiterMemory({
  points: 10,
  duration: 1,
});
