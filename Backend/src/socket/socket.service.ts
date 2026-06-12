import { Server as SocketServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { redisPub, redisSub } from '../config/redis';
import { serverConfig } from '../config';
import logger from '../config/logger.config';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  BookingConfirmedPayload,
  BookingCancelledPayload,
  BookingNoShowPayload,
  ServiceCheckedInPayload,
  ServiceCompletedPayload,
  ServiceDelayedPayload,
  QueueUpdatedPayload,
  PaymentReceivedPayload,
  EscrowReleasedPayload,
  BusinessSubmittedPayload,
  BusinessApprovedPayload,
  BusinessRejectedPayload,
  LeaveApprovedPayload,
  LeaveRejectedPayload,
  LeaveRequestedPayload,
  NewNotificationPayload,
} from './socket.types';

export type TypedSocketServer = SocketServer<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

let io: TypedSocketServer | null = null;

export function initSocket(httpServer: HttpServer): TypedSocketServer {
  io = new SocketServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      cors: {
        origin:      serverConfig.CORS_ORIGIN ?? '*',
        credentials: true,
      },
      pingTimeout:  20_000,
      pingInterval: 25_000,
    }
  );

  io.adapter(createAdapter(redisPub, redisSub));
  logger.info('[Socket.io] Redis adapter attached');

  io.use(authMiddleware);
  io.on('connection', handleConnection);

  logger.info('[Socket.io] Server initialized');
  return io;
}

async function authMiddleware(socket: TypedSocket, next: (err?: Error) => void) {
  try {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) return next(new Error('Authentication required'));

    const payload = jwt.verify(token, serverConfig.JWT_SECRET) as {
      userId:      string;
      role:        'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
      entityId:    string;
      businessId?: string;
    };

    socket.data.userId     = payload.userId;
    socket.data.role       = payload.role;
    socket.data.entityId   = payload.entityId;
    socket.data.businessId = payload.businessId;

    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
}

function handleConnection(socket: TypedSocket) {
  const { userId, role, entityId, businessId } = socket.data;
  logger.info(`[Socket.io] Connected: ${userId} (${role})`);

  socket.join(`user:${userId}`);
  socket.join(`role:${role}`);

  switch (role) {
    case 'STAFF':
      socket.join(`queue:staff:${entityId}`);
      break;
    case 'ADMIN':
      socket.join('role:admin');
      break;
    case 'BUSINESS':
      if (businessId) {
        socket.join(`business:${businessId}`);
        logger.info(`[Socket.io] BUSINESS ${userId} auto-joined business:${businessId}`);
      }
      break;
  }

  socket.on('join:business', (bId: string) => {
    if (role === 'OWNER' || role === 'ADMIN') {
      socket.join(`business:${bId}`);
      logger.info(`[Socket.io] ${userId} joined business:${bId}`);
    }
  });

  socket.on('leave:business', (bId: string) => {
    socket.leave(`business:${bId}`);
  });

  socket.on('disconnect', (reason) => {
    logger.info(`[Socket.io] Disconnected: ${userId} (${reason})`);
  });
}

export function getIO(): TypedSocketServer {
  if (!io) throw new Error('[Socket.io] Not initialized — call initSocket first');
  return io;
}

function userRoom(userId: string)         { return getIO().to(`user:${userId}`); }
function staffQueueRoom(staffId: string)  { return getIO().to(`queue:staff:${staffId}`); }
function businessRoom(businessId: string) { return getIO().to(`business:${businessId}`); }
function adminRoom()                      { return getIO().to('role:admin'); }

export const socketService = {

  notifyBookingConfirmed(customerUserId: string, staffUserId: string, businessId: string, payload: BookingConfirmedPayload): void {
    userRoom(customerUserId).emit('booking:confirmed', payload);
    userRoom(staffUserId).emit('booking:confirmed', payload);
    businessRoom(businessId).emit('booking:confirmed', payload);
  },

  notifyBookingCancelled(customerUserId: string, staffUserId: string, businessId: string, payload: BookingCancelledPayload): void {
    userRoom(customerUserId).emit('booking:cancelled', payload);
    userRoom(staffUserId).emit('booking:cancelled', payload);
    businessRoom(businessId).emit('booking:cancelled', payload);
  },

  notifyNoShow(staffUserId: string, businessId: string, payload: BookingNoShowPayload): void {
    userRoom(staffUserId).emit('booking:no_show', payload);
    businessRoom(businessId).emit('booking:no_show', payload);
  },

  notifyCheckedIn(customerUserId: string, staffUserId: string, businessId: string, payload: ServiceCheckedInPayload): void {
    userRoom(customerUserId).emit('service:checked_in', payload);
    userRoom(staffUserId).emit('service:checked_in', payload);
    businessRoom(businessId).emit('service:checked_in', payload);
  },

  notifyServiceCompleted(customerUserId: string, businessId: string, payload: ServiceCompletedPayload): void {
    userRoom(customerUserId).emit('service:completed', payload);
    businessRoom(businessId).emit('service:completed', payload);
  },

  notifyDelay(customerUserId: string, staffId: string, payload: ServiceDelayedPayload): void {
    userRoom(customerUserId).emit('service:delayed', payload);
    staffQueueRoom(staffId).emit('service:delayed', payload);
  },

  notifyQueueUpdated(staffId: string, businessId: string, payload: QueueUpdatedPayload): void {
    staffQueueRoom(staffId).emit('queue:updated', payload);
    businessRoom(businessId).emit('queue:updated', payload);
  },

  notifyPaymentReceived(businessId: string, payload: PaymentReceivedPayload): void {
    businessRoom(businessId).emit('payment:received', payload);
  },

  notifyEscrowReleased(ownerUserId: string, businessId: string, payload: EscrowReleasedPayload): void {
    userRoom(ownerUserId).emit('escrow:released', payload);
    businessRoom(businessId).emit('escrow:released', payload);
  },

  notifyBusinessSubmitted(payload: BusinessSubmittedPayload): void {
    adminRoom().emit('business:submitted', payload);
  },

  notifyBusinessApproved(ownerUserId: string, payload: BusinessApprovedPayload): void {
    userRoom(ownerUserId).emit('business:approved', payload);
    adminRoom().emit('business:approved', payload);
  },

  notifyBusinessRejected(ownerUserId: string, payload: BusinessRejectedPayload): void {
    userRoom(ownerUserId).emit('business:rejected', payload);
  },

  notifyLeaveRequested(ownerUserId: string, payload: LeaveRequestedPayload): void {
    userRoom(ownerUserId).emit('staff:leave_requested', payload);
  },

  notifyLeaveApproved(staffUserId: string, payload: LeaveApprovedPayload): void {
    userRoom(staffUserId).emit('staff:leave_approved', payload);
  },

  notifyLeaveRejected(staffUserId: string, payload: LeaveRejectedPayload): void {
    userRoom(staffUserId).emit('staff:leave_rejected', payload);
  },

  notifyNew(userId: string, payload: NewNotificationPayload): void {
    userRoom(userId).emit('notification:new', payload);
  },
};

const SPEC_ALIAS: Record<string, string> = {
  "queue:updated":    "QUEUE_UPDATED",
  "service:checked_in": "BOOKING_STARTED",
  "service:completed":  "BOOKING_COMPLETED",
  "booking:cancelled":  "BOOKING_CANCELLED",
};

export function emitToUser(userId: string, event: string, payload: unknown): void {
  try {
    const io = getIO();
    io.to(`user:${userId}`).emit(event as any, payload as any);
    const alias = SPEC_ALIAS[event];
    if (alias) io.to(`user:${userId}`).emit(alias as any, payload as any);
  } catch {
  }
}

export function emitToBusiness(businessId: string, event: string, payload: unknown): void {
  try {
    const io = getIO();
    io.to(`business:${businessId}`).emit(event as any, payload as any);
    const alias = SPEC_ALIAS[event];
    if (alias) io.to(`business:${businessId}`).emit(alias as any, payload as any);
  } catch {
  }
}
