export interface ServerToClientEvents {
    'booking:confirmed':         (data: BookingConfirmedPayload)       => void;
    'booking:cancelled':         (data: BookingCancelledPayload)        => void;
    'booking:no_show':           (data: BookingNoShowPayload)           => void;

    'service:checked_in':        (data: ServiceCheckedInPayload)        => void;
    'service:started':           (data: ServiceStartedPayload)          => void;
    'service:completed':         (data: ServiceCompletedPayload)        => void;
    'service:delayed':           (data: ServiceDelayedPayload)          => void;

    'queue:updated':             (data: QueueUpdatedPayload)            => void;
    'queue:position_changed':    (data: QueuePositionChangedPayload)    => void;

    'payment:received':          (data: PaymentReceivedPayload)         => void;
    'payment:refunded':          (data: PaymentRefundedPayload)         => void;
    'escrow:released':           (data: EscrowReleasedPayload)          => void;
  
    'business:approved':         (data: BusinessApprovedPayload)        => void;
    'business:rejected':         (data: BusinessRejectedPayload)        => void;

    'staff:leave_approved':      (data: LeaveApprovedPayload)           => void;
    'staff:leave_rejected':      (data: LeaveRejectedPayload)           => void;
    'staff:leave_requested':     (data: LeaveRequestedPayload)          => void;

    'notification:new':          (data: NewNotificationPayload)         => void;

    'error':                     (data: { message: string })            => void;
}


export interface ClientToServerEvents {
  
    'join:business':    (businessId: string) => void;
    'leave:business':   (businessId: string) => void;

    'ping':             () => void;
}

// ─── Inter-server Events (Redis adapter) ─────────────────────────────────────
export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
    userId:   string;
    role:     'CUSTOMER' | 'STAFF' | 'OWNER' | 'ADMIN';
    entityId: string;   
}

export interface BookingConfirmedPayload {
    bookingId:      string;
    bookingNumber:  string;
    businessName:   string;
    staffName:      string;
    services:       string[];
    arrivalStart:   string;
    arrivalEnd:     string;
    serviceStart:   string;
    serviceEnd:     string;
    qrCodeUrl:      string;
    amount:         number;
}

export interface BookingCancelledPayload {
    bookingId:     string;
    bookingNumber: string;
    reason:        string;
    refundAmount?: number;
}

export interface BookingNoShowPayload {
    bookingId:     string;
    bookingNumber: string;
    customerName:  string;
}

export interface ServiceCheckedInPayload {
    bookingId:    string;
    customerName: string;
    staffId:      string;
    checkedInAt:  string;
}

export interface ServiceStartedPayload {
    bookingId:       string;
    estimatedEndTime: string;
}

export interface ServiceCompletedPayload {
    bookingId:       string;
    bookingNumber:   string;
    actualDuration:  number;  
    completedAt:     string;
}

export interface ServiceDelayedPayload {
    bookingId:        string;
    staffId:          string;
    delayMinutes:     number;
    newServiceStart:  string;
    newServiceEnd:    string;
    message:          string;
}

export interface QueueUpdatedPayload {
    staffId:    string;
    date:       string;
    queueItems: QueueItem[];
    totalCount: number;
}

export interface QueueItem {
    position:     number;
    bookingId:    string;
    customerName: string;
    services:     string[];
    arrivalStart: string;
    serviceStart: string;
    serviceEnd:   string;
    status:       string;
}

export interface QueuePositionChangedPayload {
    bookingId:       string;
    newPosition:     number;
    newServiceStart: string;
    newServiceEnd:   string;
    message:         string;
}

export interface PaymentReceivedPayload {
    bookingId:      string;
    bookingNumber:  string;
    amount:         number;
    customerName:   string;
    staffName:      string;
}

export interface PaymentRefundedPayload {
    bookingId:     string;
    bookingNumber: string;
    amount:        number;
}

export interface EscrowReleasedPayload {
    bookingId:      string;
    bookingNumber:  string;
    amount:         number;
    newBalance:     number;
}

export interface BusinessApprovedPayload {
    businessId:   string;
    businessName: string;
    message:      string;
}

export interface BusinessRejectedPayload {
    businessId:   string;
    businessName: string;
    reason:       string;
}

export interface LeaveApprovedPayload {
    leaveId:   string;
    startDate: string;
    endDate:   string;
    message:   string;
}

export interface LeaveRejectedPayload {
    leaveId:   string;
    startDate: string;
    endDate:   string;
    reason:    string;
}

export interface LeaveRequestedPayload {
    leaveId:   string;
    staffName: string;
    startDate: string;
    endDate:   string;
    reason:    string;
}

export interface NewNotificationPayload {
    id:        string;
    type:      string;
    title:     string;
    message:   string;
    data?:     Record<string, unknown>;
    createdAt: string;
}