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
    io = new SocketServer<
                ClientToServerEvents,
                ServerToClientEvents,
                InterServerEvents,
                SocketData
            >(httpServer, {
                cors: {
                    origin:      serverConfig.CORS_ORIGIN ?? '*',
                    credentials: true,
                },
                pingTimeout:  20_000,
                pingInterval: 25_000,
            });

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

        if (!token) {
            return next(new Error('Authentication required'));
        }

        const payload = jwt.verify(token, serverConfig.JWT_SECRET) as {
            userId:   string;
            role:     'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
            entityId: string;
        };

        socket.data.userId   = payload.userId;
        socket.data.role     = payload.role;
        socket.data.entityId = payload.entityId;

        next();
    } catch {
        next(new Error('Invalid or expired token'));
    }
}

function handleConnection(socket: TypedSocket) {
    const { userId, role, entityId } = socket.data;
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
    }

    socket.on('join:business', (businessId: string) => {
        if (['OWNER', 'ADMIN'].includes(role)) {
            socket.join(`business:${businessId}`);
            logger.info(`[Socket.io] ${userId} joined business:${businessId}`);
        }
    });

    socket.on('leave:business', (businessId: string) => {
        socket.leave(`business:${businessId}`);
    });

    socket.on('disconnect', (reason) => {
        logger.info(`[Socket.io] Disconnected: ${userId} (${reason})`);
    });
}

export function getIO(): TypedSocketServer {
    if (!io) throw new Error('[Socket.io] Not initialized — call initSocket first');
    return io;
}

const e = (room: string, event: keyof ServerToClientEvents, data: any) => {
    getIO().to(room).emit(event as any, data);
};

export const socketService = {

    notifyBookingConfirmed(customerUserId: string, staffUserId: string, businessId: string, payload: BookingConfirmedPayload) {
        e(`user:${customerUserId}`, 'booking:confirmed', payload);
        e(`user:${staffUserId}`,    'booking:confirmed', payload);
        e(`business:${businessId}`, 'booking:confirmed', payload);
    },

    notifyBookingCancelled(customerUserId: string, staffUserId: string, businessId: string, payload: BookingCancelledPayload) {
        e(`user:${customerUserId}`, 'booking:cancelled', payload);
        e(`user:${staffUserId}`,    'booking:cancelled', payload);
        e(`business:${businessId}`, 'booking:cancelled', payload);
    },

    notifyNoShow(staffUserId: string, businessId: string, payload: BookingNoShowPayload) {
        e(`user:${staffUserId}`,    'booking:no_show', payload);
        e(`business:${businessId}`, 'booking:no_show', payload);
    },

    notifyCheckedIn(customerUserId: string, staffUserId: string, businessId: string, payload: ServiceCheckedInPayload) {
        e(`user:${customerUserId}`, 'service:checked_in', payload);
        e(`user:${staffUserId}`,    'service:checked_in', payload);
        e(`business:${businessId}`, 'service:checked_in', payload);
    },

    notifyServiceCompleted(customerUserId: string, businessId: string, payload: ServiceCompletedPayload) {
        e(`user:${customerUserId}`, 'service:completed', payload);
        e(`business:${businessId}`, 'service:completed', payload);
    },

    notifyDelay(customerUserId: string, staffId: string, payload: ServiceDelayedPayload) {
        e(`user:${customerUserId}`, 'service:delayed', payload);
        e(`queue:staff:${staffId}`, 'service:delayed', payload);
    },

    notifyQueueUpdated(staffId: string, businessId: string, payload: QueueUpdatedPayload) {
        e(`queue:staff:${staffId}`, 'queue:updated', payload);
        e(`business:${businessId}`, 'queue:updated', payload);
    },

    notifyPaymentReceived(businessId: string, payload: PaymentReceivedPayload) {
        e(`business:${businessId}`, 'payment:received', payload);
    },

    notifyEscrowReleased(ownerUserId: string, payload: EscrowReleasedPayload) {
        e(`user:${ownerUserId}`, 'escrow:released', payload);
    },

    notifyBusinessApproved(ownerUserId: string, payload: BusinessApprovedPayload) {
        e(`user:${ownerUserId}`, 'business:approved', payload);
        e('role:admin',           'business:approved', payload);
    },

    notifyBusinessRejected(ownerUserId: string, payload: BusinessRejectedPayload) {
        e(`user:${ownerUserId}`, 'business:rejected', payload);
    },

    notifyLeaveApproved(staffUserId: string, payload: LeaveApprovedPayload) {
        e(`user:${staffUserId}`, 'staff:leave_approved', payload);
    },

    notifyLeaveRejected(staffUserId: string, payload: LeaveRejectedPayload) {
        e(`user:${staffUserId}`, 'staff:leave_rejected', payload);
    },

    notifyLeaveRequested(ownerUserId: string, payload: LeaveRequestedPayload) {
        e(`user:${ownerUserId}`, 'staff:leave_requested', payload);
    },

    notifyNew(userId: string, payload: NewNotificationPayload) {
        e(`user:${userId}`, 'notification:new', payload);
    },
};