/**
 * rateLimiter.middleware.ts  (FIXED)
 *
 * Changes vs original:
 * - paymentLimiter REMOVED and replaced with two separate limiters:
 *     paymentOrderLimiter  (prefix: payment:order)
 *     paymentVerifyLimiter (prefix: payment:verify)
 *   This eliminates the duplicate "paymentLimiter" card in the dashboard.
 *
 * All other limiters unchanged.
 */

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import type { Request } from 'express';
import type { AuthRequest } from './types';

function makeStore(prefix: string): RedisStore {
  return new RedisStore({
    sendCommand: (...args: string[]) => (redisClient as any).call(...args),
    prefix: `rl:${prefix}:`,
  });
}

function keyByUserId(req: Request): string {
  const userId = (req as AuthRequest).user?.userId;
  if (userId) {
    return `user:${userId}`;
  }
  return ipKeyGenerator(req.ip ?? 'anon');
}

type LimiterOpts = Parameters<typeof rateLimit>[0] & { prefix: string };

function makeLimiter({ prefix, ...opts }: LimiterOpts) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders:   false,
    store:           makeStore(prefix),
    skip:            (req) => req.method === 'OPTIONS',
    ...opts,
  });
}

export const globalLimiter = makeLimiter({
  prefix:    'global',
  windowMs:  60 * 1000,
  max:       200,
  message:   { success: false, message: 'Too many requests. Please slow down.' },
});

export const loginLimiter = makeLimiter({
  prefix:    'auth:login',
  windowMs:  60 * 1000,
  max:       5,
  message:   { success: false, message: 'Too many login attempts. Please wait 1 minute.' },
});

export const registerLimiter = makeLimiter({
  prefix:    'auth:register',
  windowMs:  60 * 1000,
  max:       5,
  message:   { success: false, message: 'Too many registration attempts. Please wait 1 minute.' },
});

export const passwordResetLimiter = makeLimiter({
  prefix:    'auth:reset',
  windowMs:  60 * 1000,
  max:       5,
  message:   { success: false, message: 'Too many reset requests. Please wait 1 minute.' },
});

export const bookingLimiter = makeLimiter({
  prefix:       'booking:create',
  windowMs:     60 * 1000,
  max:          3,
  keyGenerator: keyByUserId,
  message:      { success: false, message: 'You can create up to 3 bookings per minute.' },
});

// ── Payment: two separate limiters (fixes duplicate dashboard card) ───────────

/** Limits POST /payment/order — order creation */
export const paymentOrderLimiter = makeLimiter({
  prefix:       'payment:order',
  windowMs:     60 * 1000,
  max:          10,
  keyGenerator: keyByUserId,
  message:      { success: false, message: 'Payment order rate limit exceeded. Please wait 1 minute.' },
});

/** Limits POST /payment/verify — payment verification */
export const paymentVerifyLimiter = makeLimiter({
  prefix:       'payment:verify',
  windowMs:     60 * 1000,
  max:          10,
  keyGenerator: keyByUserId,
  message:      { success: false, message: 'Payment verify rate limit exceeded. Please wait 1 minute.' },
});

export const scanLimiter = makeLimiter({
  prefix:       'qr:scan',
  windowMs:     60 * 1000,
  max:          20,
  keyGenerator: keyByUserId,
  message:      { success: false, message: 'QR scan rate limit exceeded.' },
});

export const reviewLimiter = makeLimiter({
  prefix:       'review:submit',
  windowMs:     60 * 60 * 1000,
  max:          5,
  keyGenerator: keyByUserId,
  message:      { success: false, message: 'Review limit reached. Up to 5 reviews per hour.' },
});

export const exploreLimiter = makeLimiter({
  prefix:    'explore',
  windowMs:  60 * 1000,
  max:       100,
  message:   { success: false, message: 'Search rate limit exceeded. Please slow down.' },
});

export const apiLimiter = makeLimiter({
  prefix:    'api',
  windowMs:  15 * 60 * 1000,
  max:       100,
  message:   { success: false, message: 'Too many requests. Please slow down.' },
});

export const strictLimiter = makeLimiter({
  prefix:    'strict',
  windowMs:  60 * 60 * 1000,
  max:       10,
  message:   { success: false, message: 'Rate limit exceeded. Please try again later.' },
});