import axios from 'axios';
import { randomUUID } from 'crypto';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { AuthRequest } from './types';
import { prisma } from '../config/prisma';
import logger from '../config/logger.config';

const REQTROL_URL = process.env.REQTROL_URL || 'http://localhost:4000';
const TIMEOUT_MS  = 500;

async function fetchAvatar(userId: string, role: string): Promise<string> {
  try {
    const sel = { avatar_url: true } as const;
    let row: { avatar_url: string | null } | null = null;
    if      (role === 'CUSTOMER') row = await prisma.customer.findUnique({ where: { user_id: userId }, select: sel });
    else if (role === 'OWNER')    row = await prisma.owner.findUnique(   { where: { user_id: userId }, select: sel });
    else if (role === 'STAFF')    row = await prisma.staff.findUnique(   { where: { user_id: userId }, select: sel });
    else if (role === 'ADMIN')    row = await prisma.admin.findUnique(   { where: { user_id: userId }, select: sel });
    return row?.avatar_url ?? '';
  } catch { return ''; }
}

function fireTrack(payload: Record<string, unknown>): void {
  axios.post(`${REQTROL_URL}/api/v1/track`, payload, { timeout: 1000 })
    .catch((err: Error) => logger.warn(`[Reqtrol] Track push failed: ${err.message}`));
}


export async function reqtrolMiddleware(
  req:  Request,
  res:  Response,
  next: NextFunction
): Promise<void> {
  const start     = Date.now();
  const requestId = randomUUID();
  const authReq   = req as AuthRequest;

  const userId    = authReq.user?.userId ?? 'anon';
  const userAgent = req.headers['user-agent'] ?? 'unknown';
  const endpoint  = req.path;
  const method    = req.method;
  const ip        = req.ip ?? req.socket?.remoteAddress ?? 'unknown';

  try {
    const { data } = await axios.post(
      `${REQTROL_URL}/api/v1/check-limit`,
      {
        requestId, userId, endpoint,
        action:    endpoint.split('/').filter(Boolean)[0] ?? 'unknown',
        method, ip, userAgent,
        timestamp: Date.now(), service: 'quby', source: 'quby',
      },
      { timeout: TIMEOUT_MS }
    );

    const responseTimeMs = Date.now() - start;

    fireTrack({
      requestId, userId, endpoint,
      action:         endpoint.split('/').filter(Boolean)[0] ?? 'unknown',
      method, ip, userAgent,
      allowed:        data.allowed ?? true,
      reason:         data.reason  ?? null,
      limit:          data.limit   ?? 0,
      remaining:      data.remaining ?? 0,
      resetIn:        data.resetIn ?? 0,
      service: 'quby', source: 'quby',
      algorithm:      data.algorithm ?? 'fixed-window',
      limiterName:    data.limiterName ?? '',
      statusCode:     data.allowed ? 200 : 429,
      responseTimeMs, timestamp: Date.now(),
    });

    if (!data.allowed) {
      res.status(429).json({ success: false, message: 'Rate limit exceeded.', retryAfter: data.resetIn ?? 60, requestId });
      return;
    }
    next();
  } catch {
    logger.warn(`[Reqtrol] Unreachable — failing open for ${endpoint}`);
    next();
  }
}

export function reqtrolRateLimiter(
  limiterName: string,
  limiter:     RequestHandler,
): RequestHandler {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    if (res.locals.reqtrolTracked) return limiter(req, res, next);
    
    const start     = Date.now();
    const requestId = randomUUID();
    const endpoint  = req.path;
    const method    = req.method;
    const ip        = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const userAgent = req.headers['user-agent'] ?? 'unknown';
    const action    = endpoint.split('/').filter(Boolean)[0] ?? 'unknown';
    const source    = req.headers['x-reqtrol-simulator'] === 'true' ? 'simulator' : 'quby';
    
    const authUser    = (req as AuthRequest).user;
    const isAuthed    = !!authUser?.userId;
    let userId        = isAuthed ? authUser!.userId : 'anon';
    let userName      = '';
    let avatarUrl     = '';

    if (isAuthed) {
      try {
        const sel = { name: true, avatar_url: true } as const;
        let row: { name: string; avatar_url: string | null } | null = null;
        const role = authUser!.role;
        
        if      (role === 'CUSTOMER') row = await prisma.customer.findUnique({ where: { user_id: userId }, select: sel });
        else if (role === 'OWNER')    row = await prisma.owner.findUnique(   { where: { user_id: userId }, select: sel });
        else if (role === 'STAFF')    row = await prisma.staff.findUnique(   { where: { user_id: userId }, select: sel });
        else if (role === 'ADMIN')    row = await prisma.admin.findUnique(   { where: { user_id: userId }, select: sel });
        
        userName  = row?.name       ?? '';
        avatarUrl = row?.avatar_url ?? '';
      } catch { /* keep empty strings */ }
    }

    // CRITICAL FIX: Call /check-limit FIRST, before local limiter
    try {
      const { data } = await axios.post(
        `${REQTROL_URL}/api/v1/check-limit`,
        {
          requestId, userId, userName, avatarUrl,
          endpoint, action, method, ip, userAgent,
          timestamp: Date.now(),
          service: 'quby',
          source,
        },
        { timeout: TIMEOUT_MS }
      );

      const responseTimeMs = Date.now() - start;

      // Track the result
      fireTrack({
        requestId, userId, userName, avatarUrl,
        endpoint, action, method, ip, userAgent,
        allowed:        data.allowed ?? true,
        reason:         data.reason  ?? null,
        limit:          data.limit   ?? 0,
        remaining:      data.remaining ?? 0,
        resetIn:        data.resetIn ?? 0,
        service: 'quby',
        source,
        algorithm:      data.algorithm ?? 'fixed-window',
        limiterName:    data.limiterName ?? limiterName,
        statusCode:     data.allowed ? 200 : 429,
        responseTimeMs,
        timestamp: Date.now(),
      });

      res.locals.reqtrolTracked = true;

      // If Reqtrol blocked, return 429 immediately
      if (!data.allowed) {
        res.status(429).json({
          success: false,
          message: 'Rate limit exceeded.',
          retryAfter: data.resetIn ?? 60,
          requestId
        });
        return;
      }

      // Otherwise, continue to local limiter (for backward compatibility)
      next();
      
    } catch (err) {
      // If Reqtrol is down, fail open and continue
      logger.warn(`[Reqtrol] Unreachable for ${endpoint} — failing open`);
      res.locals.reqtrolTracked = true;
      next();
    }
  };
}
