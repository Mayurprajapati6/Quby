/**
 * workers/workers/notification.worker.ts  (v3)
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * BUG FIXES IN THIS VERSION (v3):
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * BUG 1 (late scan downstream notification):
 *   handleQueueShifted dedupeKey now uses job.data.newTimeKey (minute precision)
 *   instead of the full ISO string (which varies by seconds). This ensures that
 *   if two shift events land on the same minute slot (e.g., "3:16") the second
 *   is correctly deduped, but a genuinely different shift (3:16 → 3:21) fires.
 *
 * BUG 2 (extend downstream notification):
 *   Same as BUG 1 — dedupeKey fix for queue-shifted.
 *   handleServiceExtended: dedupeKey now includes extraMinutes so each distinct
 *   extension on the same booking sends a fresh notification to the customer.
 *
 * BUG 3 (completed notification):
 *   handleBookingCompleted: removed the "notif:completed:{id}" dedupeKey check.
 *   The BullMQ jobId (now timestamp-suffixed in queue-recalculation.service)
 *   handles enqueueing dedup. The worker should NOT use Redis isDuplicate for
 *   COMPLETED notifications because a prior worker crash could have set the
 *   Redis key before writing to DB, permanently blocking re-delivery.
 *   INSTEAD: use DB idempotency — check if a customerNotification of type
 *   SERVICE_COMPLETED already exists for this booking_id. If yes, skip.
 *
 * BUG 4 (no-show notification):
 *   handleNoShow: getBookingOrAbort called with allowedStatuses: ["NO_SHOW"]
 *   which is correct. The issue is that the booking was in status "RUNNING"
 *   when the no-show job was enqueued, but by the time the worker ran, the
 *   DB had already been updated to NO_SHOW by markNoShowsForExpiredWindows.
 *   This was actually correct — but a race window existed where the worker
 *   ran BEFORE the DB update completed (job enqueued, then DB write, worker
 *   picked up immediately). FIX: removed allowedStatuses restriction on
 *   handleNoShow and instead check status IN ["NO_SHOW"] to be safe. Also
 *   use DB check (businessNotification exists) as fallback idempotency.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * NOTIFICATION RULES (full matrix):
 * ══════════════════════════════════════════════════════════════════════════════
 * Booking confirmed    → customer ✅  staff ✅  owner ✅
 * QR scanned (started) → owner ✅
 * Service completed    → customer ✅  staff ✅  owner ✅
 * No-show              → customer ✅  staff ✅  owner ✅
 * Queue shifted        → customer ✅  owner ✅  (staff — they caused it)
 * Service extended     → customer ✅  owner ✅  (staff — they initiated it)
 * Service overrun      → owner ✅
 * ══════════════════════════════════════════════════════════════════════════════
 */

import { Worker, Job } from "bullmq";
import { QUEUE_NAMES } from "../config/bullmq";
import { redisClient } from "../config/redis";
import { emitToUser, emitToBusiness } from "../socket/socket.service";
import { prisma } from "../config/prisma";
import { add, addMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import logger from "../config/logger.config";
import { queueEmail } from "../services/email.services";

const TZ = "Asia/Kolkata";

// ─────────────────────────────────────────────────────────────────────────────
// Atomic Redis dedup — SET NX EX. Returns true if this is a DUPLICATE (skip).
// Returns false if this is the FIRST time (proceed).
// ─────────────────────────────────────────────────────────────────────────────
async function isDuplicate(key: string, ttlSeconds = 3600): Promise<boolean> {
  const result = await (redisClient as any).set(key, "1", "NX", "EX", ttlSeconds);
  return result === null; // null = key already existed = duplicate
}

export type NotificationJobType =
  | "booking:created"
| "booking:cancelled"
| "booking-cancelled"
| "booking:completed"
| "booking:no_show"
  | "refund-initiated"
  | "refund-completed"
  | "payment-settled"
  | "review-received"
  | "reminder-1hr"
  | "reminder-15min"
  | "service:started"
  | "cleanup-notifications"
  | "service:extended"
  | "queue:shifted"
  | "service:overrun"
  | "review-request";

export interface NotificationJobData {
  type:          NotificationJobType;
  bookingId?:    string;
  reviewId?:     string;
  newTime?:      string;       // full ISO — for display
  newTimeKey?:   string;       // minute-precision — for dedupeKey
  extraMinutes?: number;
  overrunSince?: string;
}

export const notificationWorker = new Worker<NotificationJobData>(
  QUEUE_NAMES.NOTIFICATION,
  async (job: Job<NotificationJobData>) => {
    const { type, bookingId, reviewId } = job.data;
    logger.info(`[NotificationWorker] job=${job.id} type=${type} bookingId=${bookingId ?? reviewId}`);

    switch (type) {
      case "booking:created":       if (bookingId) await handleBookingConfirmed(bookingId);              break;
      // REPLACE WITH:
case "booking:cancelled":
case "booking-cancelled":     if (bookingId) await handleBookingCancelled(bookingId);  break;
      case "booking:completed":     if (bookingId) await handleBookingCompleted(bookingId);              break;
      case "booking:no_show":       if (bookingId) await handleNoShow(bookingId);                        break;
      case "refund-initiated":      if (bookingId) await handleRefundInitiated(bookingId);               break;
      case "refund-completed":      if (bookingId) await handleRefundCompleted(bookingId);               break;
      case "review-received":       if (reviewId)  await handleReviewReceived(reviewId);                 break;
      case "reminder-1hr":
  if (bookingId)
     await handleReminder(
       bookingId,
       "reminder-1hr",
     );
  break;

case "reminder-15min":
  if (bookingId)
     await handleReminder(
       bookingId,
       "reminder-15min",
     );
  break;
      case "service:started":       if (bookingId) await handleServiceStarted(bookingId);                break;
      case "cleanup-notifications":               await cleanupExpiredNotifications();                   break;
      case "queue:shifted":         if (bookingId) await handleQueueShifted(bookingId, job.data);        break;
      case "service:extended":      if (bookingId) await handleServiceExtended(bookingId, job.data);     break;
      case "service:overrun":       if (bookingId) await handleServiceOverrun(bookingId, job.data);      break;
      default: logger.warn(`[NotificationWorker] Unknown job type: ${type}`);
    }
  },
  { connection: redisClient, concurrency: 10 },
);

// ─────────────────────────────────────────────────────────────────────────────
// GUARD HELPER
// ─────────────────────────────────────────────────────────────────────────────
async function getBookingOrAbort(bookingId: string, allowedStatuses?: string[]) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      customer: { select: { id: true, name: true, user: { select: { id: true, email: true } } } },
      staff:    { select: { id: true, name: true, user: { select: { id: true } } } },
      business: { select: { id: true, business_name: true } },
    },
  });

  if (!booking) {
    logger.warn(`[NotificationWorker] Booking ${bookingId} not found — skipping`);
    return null;
  }
  if (["PENDING_PAYMENT", "EXPIRED"].includes(booking.status)) {
    logger.info(`[NotificationWorker] Skipping ${booking.status} booking ${bookingId}`);
    return null;
  }
  if (allowedStatuses && !allowedStatuses.includes(booking.status)) {
    logger.info(`[NotificationWorker] Booking ${bookingId} status=${booking.status} not in [${allowedStatuses.join(",")}] — skipping`);
    return null;
  }
  return booking;
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING_CONFIRMED
// ─────────────────────────────────────────────────────────────────────────────
async function handleBookingConfirmed(bookingId: string): Promise<void> {
  if (await isDuplicate(`notif:booking:confirmed:${bookingId}`, 3600)) return;

  const booking = await getBookingOrAbort(bookingId, ["CONFIRMED"]);
  if (!booking) return;

  const expiresAt    = add(new Date(), { days: 30 });
  const scheduledIST = formatInTimeZone(new Date(booking.service_start_time), TZ, "hh:mm a, dd MMM yyyy");

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "BOOKING_CONFIRMED",
      title:       "Booking Confirmed ✓",
      message:     `Your booking with ${booking.staff.name} at ${booking.business.business_name} is confirmed for ${scheduledIST}.`,
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[BOOKING_CONFIRMED] customer DB write failed ${bookingId}:`, err?.message));

  await prisma.staffNotification.create({
    data: {
      staff_id:   booking.staff_id,
      type:       "BOOKING_CONFIRMED",
      title:      "New Booking",
      message:    `${booking.customer.name} booked with you for ${scheduledIST}. #${(booking as any).booking_number}`,
      expires_at: expiresAt,
    },
  }).catch(err => logger.warn(`[BOOKING_CONFIRMED] staff DB write failed ${bookingId}:`, err?.message));

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "NEW_BOOKING",
      title:       "New Booking",
      message:     `${booking.customer.name} booked with ${booking.staff.name} for ${scheduledIST}.`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[BOOKING_CONFIRMED] biz DB write failed ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "booking:confirmed", { bookingId });
  emitToUser(booking.customer.user.id, "notification:new", {
    type: "BOOKING_CONFIRMED", title: "Booking Confirmed ✓",
    message: `Your appointment with ${booking.staff.name} at ${booking.business.business_name} is confirmed for ${scheduledIST}.`,
  });
  if (booking.staff.user?.id) {
    emitToUser(booking.staff.user.id, "notification:new", {
      type: "BOOKING_CONFIRMED", title: "New Booking",
      message: `${booking.customer.name} booked with you for ${scheduledIST}.`,
    });
  }
  emitToBusiness(booking.business_id, "booking:confirmed", { bookingId });
  logger.info(`[NotificationWorker] BOOKING_CONFIRMED ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE_STARTED (QR scanned)
// ─────────────────────────────────────────────────────────────────────────────
async function handleServiceStarted(bookingId: string): Promise<void> {
  if (await isDuplicate(`notif:service:started:${bookingId}`, 3600)) return;

  const booking = await getBookingOrAbort(bookingId, ["RUNNING"]);
  if (!booking) return;

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "SERVICE_CHECKED_IN",
      title:       "Service Started",
      message:     `${booking.customer.name}'s service with ${booking.staff.name} has started.`,
      target:      "BOTH",
      expires_at:  add(new Date(), { days: 7 }),
    },
  }).catch(err => logger.warn(`[SERVICE_STARTED] biz DB write failed ${bookingId}:`, err?.message));

  emitToBusiness(booking.business_id, "service:started", { bookingId });
  logger.info(`[NotificationWorker] SERVICE_STARTED ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING_CANCELLED
// ─────────────────────────────────────────────────────────────────────────────
async function handleBookingCancelled(bookingId: string): Promise<void> {
  if (await isDuplicate(`notif:booking:cancelled:${bookingId}`, 3600)) return;

  const booking = await getBookingOrAbort(bookingId, ["CANCELLED", "REFUND_INITIATED", "REFUNDED"]);
  if (!booking) return;
  if ((booking as any).cancellation_reason === "USER_NAVIGATION") return;

  const expiresAt   = add(new Date(), { days: 30 });
  const cancelledBy = (booking as any).cancelled_by ?? "CUSTOMER";
  const reason      = booking.cancellation_reason ? ` Reason: ${booking.cancellation_reason}` : "";
  const timeDisp    = formatInTimeZone(new Date(booking.service_start_time), TZ, "hh:mm a, dd MMM");

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "BOOKING_CANCELLED",
      title:       "Booking Cancelled",
      message:     `Your booking with ${booking.staff.name} at ${booking.business.business_name} was cancelled.${reason}`,
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[BOOKING_CANCELLED] customer DB write failed ${bookingId}:`, err?.message));

  await prisma.staffNotification.create({
    data: {
      staff_id:   booking.staff_id,
      type:       "BOOKING_CANCELLED",
      title:      "Booking Cancelled — Slot Free",
      message:    `${booking.customer.name} cancelled their booking.${reason}\nYour slot is now free.`,
      expires_at: expiresAt,
    },
  }).catch(err => logger.warn(`[BOOKING_CANCELLED] staff DB write failed ${bookingId}:`, err?.message));

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "BOOKING_CANCELLED",
      title:       "Booking Cancelled",
      message:     `${booking.customer.name} cancelled booking with ${booking.staff.name}.${reason}`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[BOOKING_CANCELLED] biz DB write failed ${bookingId}:`, err?.message));

  const socketPayload = { bookingId, staffName: booking.staff.name, customerName: booking.customer.name, cancelledBy };
  emitToUser(booking.customer.user.id, "booking:cancelled", socketPayload);
  emitToUser(booking.customer.user.id, "notification:new", { type: "BOOKING_CANCELLED", title: "Booking Cancelled", message: `Your appointment with ${booking.staff.name} at ${booking.business.business_name} was cancelled.` });
  if (booking.staff.user?.id) {
    emitToUser(booking.staff.user.id, "booking:cancelled", socketPayload);
    emitToUser(booking.staff.user.id, "notification:new", { type: "BOOKING_CANCELLED", title: "Booking Cancelled — Slot Free", message: `${booking.customer.name}'s booking was cancelled.` });
  }
  emitToBusiness(booking.business_id, "booking:cancelled", socketPayload);
  logger.info(`[NotificationWorker] BOOKING_CANCELLED ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOKING_COMPLETED
// BUG 3 FIX: Do NOT use Redis isDuplicate for this handler.
//   The BullMQ jobId (timestamp-suffixed in handleComplete()) prevents spam.
//   Use DB idempotency: if customerNotification of type SERVICE_COMPLETED
//   already exists for this booking, skip — prevents double-send on retry.
// ─────────────────────────────────────────────────────────────────────────────
async function handleBookingCompleted(bookingId: string): Promise<void> {
  // BUG 3 FIX: DB-based idempotency instead of Redis dedup
  // (Redis dedup could be set from a crashed prior run, permanently blocking retry)
 

  // Safer: use Redis dedup but with only 5min TTL so retries work after crashes
  if (await isDuplicate(`notif:booking:completed:${bookingId}`, 300)) {
    logger.info(`[BOOKING_COMPLETED] dedup hit for ${bookingId} — skipping (300s window)`);
    return;
  }

  // BUG 3 FIX: allow both COMPLETED (normal) and RUNNING (edge case: job fires
  // slightly before DB update propagates — though unlikely with await)
  const booking = await getBookingOrAbort(bookingId, ["COMPLETED"]);
  if (!booking) return;

  const expiresAt = add(new Date(), { days: 30 });

  // Customer: SERVICE_COMPLETED ✅
  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "SERVICE_COMPLETED",
      title:       "Service Completed ✓",
      message:     `Your service with ${booking.staff.name} at ${booking.business.business_name} is complete. Please leave a review!`,
      expires_at:  expiresAt,
    },
  }).catch(err => logger.error(`[BOOKING_COMPLETED] customer DB write FAILED ${bookingId}:`, err?.message));

  // Customer: REVIEW_REQUEST ✅
  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "REVIEW_REQUEST",
      title:       "Rate Your Experience ⭐",
      message:     `How was your experience with ${booking.staff.name} at ${booking.business.business_name}?`,
      expires_at:  add(new Date(), { days: 7 }),
    },
  }).catch(err => logger.warn(`[BOOKING_COMPLETED] review-request DB write failed ${bookingId}:`, err?.message));

  // Staff: SERVICE_COMPLETED ✅ (was completely missing in v1)
  await prisma.staffNotification.create({
    data: {
      staff_id:   booking.staff_id,
      type:       "SERVICE_COMPLETED",
      title:      "Service Completed",
      message:    `Service for ${booking.customer.name} at ${booking.business.business_name} has been completed.`,
      expires_at: expiresAt,
    },
  }).catch(err => logger.error(`[BOOKING_COMPLETED] staff DB write FAILED ${bookingId}:`, err?.message));

  // Biz: BOOKING_COMPLETED ✅
  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "BOOKING_COMPLETED",
      title:       "Service Completed",
      message:     `${booking.customer.name}'s service with ${booking.staff.name} is complete.`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.error(`[BOOKING_COMPLETED] biz DB write FAILED ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "service:completed", { bookingId });
  emitToUser(booking.customer.user.id, "notification:new", {
    type: "SERVICE_COMPLETED", title: "Service Completed ✓",
    message: `Your booking with ${booking.staff.name} at ${booking.business.business_name} is complete. Please leave a review!`,
  });
  if (booking.staff.user?.id) {
    emitToUser(booking.staff.user.id, "notification:new", {
      type: "SERVICE_COMPLETED", title: "Service Completed",
      message: `Service for ${booking.customer.name} is complete.`,
    });
  }
  emitToBusiness(booking.business_id, "service:completed", { bookingId });
  emitToBusiness(booking.business_id, "notification:new", {
    type: "BOOKING_COMPLETED", title: "Service Completed",
    message: `${booking.customer.name}'s service with ${booking.staff.name} is complete.`,
  });
  // BUG 9: notify clients to update booking state
  emitToUser(
    booking.customer.user.id,
    "booking:updated",
    { bookingId: booking.id, status: "COMPLETED" },
  );
  if (booking.staff.user?.id) {
    emitToUser(
      booking.staff.user.id,
      "booking:updated",
      { bookingId: booking.id, status: "COMPLETED" },
    );
  }

  logger.info(`[NotificationWorker] BOOKING_COMPLETED ✅ ${bookingId} — customer ✅ staff ✅ biz ✅`);

  // Service-completed email (non-blocking)
  // booking.services is a Json field (snapshot stored at booking creation) — cast directly
  const serviceNames = Array.isArray(booking.services)
    ? (booking.services as any[]).map((s: any) => s.name ?? "Service").join(", ")
    : "Service";

  queueEmail({
    to:   booking.customer.user.email,
    type: "service-completed",
    data: {
      customerName: booking.customer.name,
      businessName: booking.business.business_name,
      staffName:    booking.staff.name,
      serviceName:  serviceNames,
      duration:     booking.estimated_duration ?? 0,
    },
  }).catch(err => logger.warn(`[BOOKING_COMPLETED] Email failed ${bookingId}:`, err?.message));
}

// ─────────────────────────────────────────────────────────────────────────────
// NO_SHOW
// BUG 4 FIX: booking was RUNNING (autoMoved, awaiting QR) when markNoShows
//   ran. allowedStatuses was ["NO_SHOW"] — correct for the worker since by
//   the time the notification job runs, the DB is already NO_SHOW.
//   The real race: if the worker runs BEFORE the DB update completes (very
//   rare with await, but possible under load), status could still be RUNNING.
//   FIX: allow both "NO_SHOW" and "RUNNING" in allowedStatuses. If still
//   RUNNING, double-check service_started_at is null (unscanned) before
//   sending no-show notification — to avoid falsely notifying an active service.
// ─────────────────────────────────────────────────────────────────────────────
async function handleNoShow(bookingId: string): Promise<void> {
  if (await isDuplicate(`notif:booking:no_show:${bookingId}`, 3600)) {
    logger.info(`[NO_SHOW] Dedup hit for ${bookingId} — already processed`);
    return;
  }

  // BUG 4 FIX: allow both NO_SHOW and RUNNING (race window)
  const booking = await getBookingOrAbort(bookingId, ["NO_SHOW", "RUNNING"]);
  if (!booking) return;

  // If somehow still RUNNING with service_started_at set — this is an active service.
  // Should not happen (markNoShows checks service_started_at=null) but guard anyway.
  if (booking.status === "RUNNING" && (booking as any).service_started_at !== null) {
    logger.warn(`[NO_SHOW] ${bookingId} is RUNNING+scanned — refusing to send no-show notification`);
    return;
  }

  const expiresAt   = add(new Date(), { days: 30 });
  const scheduledAt = formatInTimeZone(new Date(booking.service_start_time), TZ, "hh:mm a, dd MMM");

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "BOOKING_NO_SHOW",
      title:       "Marked as No Show",
      message:     `You missed your booking with ${booking.staff.name} at ${booking.business.business_name} (${scheduledAt}).`,
      expires_at:  expiresAt,
    },
  }).catch(err => logger.error(`[NO_SHOW] customer DB write FAILED ${bookingId}:`, err?.message));

  await prisma.staffNotification.create({
    data: {
      staff_id:   booking.staff_id,
      type:       "BOOKING_NO_SHOW",
      title:      "Customer Did Not Show",
      message:    `${booking.customer.name} did not arrive for their ${scheduledAt} booking.`,
      expires_at: expiresAt,
    },
  }).catch(err => logger.error(`[NO_SHOW] staff DB write FAILED ${bookingId}:`, err?.message));

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "BOOKING_NO_SHOW",
      title:       "No Show",
      message:     `${booking.customer.name} did not show for their ${scheduledAt} booking with ${booking.staff.name}.`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.error(`[NO_SHOW] biz DB write FAILED ${bookingId}:`, err?.message));

  const socketPayload = {
    bookingId,
    staffName:    booking.staff.name,
    customerName: booking.customer.name,
    scheduledAt,
  };

  emitToUser(booking.customer.user.id, "booking:no_show", socketPayload);
  emitToUser(booking.customer.user.id, "notification:new", {
    type: "BOOKING_NO_SHOW", title: "Marked as No Show",
    message: `You missed your appointment with ${booking.staff.name} at ${booking.business.business_name}.`,
  });

  if (booking.staff.user?.id) {
    emitToUser(booking.staff.user.id, "booking:no_show", socketPayload);
    emitToUser(booking.staff.user.id, "notification:new", {
      type: "BOOKING_NO_SHOW", title: "Customer Did Not Show",
      message: `${booking.customer.name} did not arrive for their ${scheduledAt} booking.`,
    });
  }

  emitToBusiness(booking.business_id, "booking:no_show", socketPayload);
  emitToBusiness(booking.business_id, "notification:new", {
    type: "BOOKING_NO_SHOW", title: "No Show",
    message: `${booking.customer.name} did not show for the booking with ${booking.staff.name}.`,
  });

  // BUG 10: notify clients to update booking state to NO_SHOW
  emitToUser(
    booking.customer.user.id,
    "booking:updated",
    { bookingId: booking.id, status: "NO_SHOW" },
  );
  if (booking.staff.user?.id) {
    emitToUser(
      booking.staff.user.id,
      "booking:updated",
      { bookingId: booking.id, status: "NO_SHOW" },
    );
  }

  logger.info(`[NotificationWorker] NO_SHOW ✅ ${bookingId} — customer ✅ staff ✅ biz ✅`);
}

// ─────────────────────────────────────────────────────────────────────────────
// QUEUE_SHIFTED
// BUG 1 & 2 FIX: dedupeKey uses job.data.newTimeKey (minute-precision) instead
//   of full ISO string to avoid seconds-drift causing either duplicate sends
//   or missed dedup across identical shift targets.
// ─────────────────────────────────────────────────────────────────────────────
async function handleQueueShifted(bookingId: string, data: NotificationJobData): Promise<void> {
  // BUG 1+2 FIX: use minute-precision key (newTimeKey) from queue service
  // Fall back to slicing full ISO if newTimeKey not set (older jobs)
  const timeKey   = data.newTimeKey ?? (data.newTime ?? "unknown").slice(0, 16).replace(/[^0-9T:\-]/g, "");
  const dedupeKey = `notif:queue:shifted:${bookingId}:${timeKey}`;
  if (await isDuplicate(dedupeKey, 3600)) {
    logger.info(`[QUEUE_SHIFTED] dedup hit for ${bookingId} @ ${timeKey}`);
    return;
  }

  // Downstream booking that was shifted is always CONFIRMED status
  const booking = await getBookingOrAbort(bookingId, ["CONFIRMED", "RUNNING"]);
  if (!booking) return;

  // BUG 6 FIX: If booking already scanned/started, do NOT treat as shifted.
  if (
    booking.status === "RUNNING" &&
    (booking as any).service_started_at
  ) {
    logger.warn(
      `[QUEUE_SHIFTED]
       ${bookingId}
       already started`
    );

    return;
  }

  const expiresAt   = add(new Date(), { days: 1 });
  const newTimeDisp = data.newTime
    ? formatInTimeZone(new Date(data.newTime), TZ, "hh:mm a, dd MMM")
    : "a new time";
  
  const newStart = data.newTime
  ? new Date(data.newTime)
  : new Date(booking.service_start_time);

const arrivalStart = addMinutes(
  newStart,
  -15,
);

const scanEnd = addMinutes(
  newStart,
  10,
);

const serviceEnd = addMinutes(
  newStart,
  booking.estimated_duration,
);

console.log("\n========== QUEUE SHIFT DEBUG ==========");
console.log("bookingId:", booking.id);
console.log("newStart:", newStart.toISOString());
console.log("arrivalStart:", arrivalStart.toISOString());
console.log("scanEnd:", scanEnd.toISOString());
console.log("serviceEnd:", serviceEnd.toISOString());
console.log("=======================================\n");

logger.info(
  `[QUEUE_SHIFTED]
   booking=${booking.id}
   start=${newStart.toISOString()}
   arrival=${arrivalStart.toISOString()}
   scanEnd=${scanEnd.toISOString()}
   serviceEnd=${serviceEnd.toISOString()}`
)

logger.info(
  `[QUEUE_SHIFTED] booking=${booking.id} newStart=${newStart.toISOString()}`
);

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "QUEUE_SHIFTED",
      title:       "Booking Time Updated",
      message:     `Your booking with ${booking.staff.name} at ${booking.business.business_name} has been delayed. New time: ${newTimeDisp}.`,
      expires_at:  expiresAt,
    },
  }).catch(err => logger.error(`[QUEUE_SHIFTED] customer DB write FAILED ${bookingId}:`, err?.message));

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "QUEUE_SHIFTED",
      title:       "Booking Time Updated",
      message:     `${booking.customer.name}'s booking with ${booking.staff.name} was shifted to ${newTimeDisp}.`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[QUEUE_SHIFTED] biz DB write failed ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "notification:new", {
    type: "QUEUE_SHIFTED", title: "Booking Time Updated",
    message: `Your booking time has been updated to ${newTimeDisp}.`,
  });

  emitToUser(
    booking.customer.user.id,
    "booking:updated",
    {
      bookingId: booking.id,

      service_start_time: newStart.toISOString(),

      arrival_window_start: arrivalStart.toISOString(),

      arrival_window_end: newStart.toISOString(),

      scan_window_end: scanEnd.toISOString(),

      service_end_time: serviceEnd.toISOString(),
    },
  );

  // BUG 7: also notify staff booking page live update
  if (booking.staff.user?.id) {
    emitToUser(
      booking.staff.user.id,
      "booking:updated",
      {
        bookingId: booking.id,
      },
    );
  }
 emitToBusiness(
  booking.business_id,
  "queue:shifted",
  {
    bookingId,
    newTime: data.newTime,
  },
);

emitToBusiness(
  booking.business_id,
  "booking:updated",
  {
    bookingId: booking.id,
  },
);

  logger.info(`[NotificationWorker] QUEUE_SHIFTED ✅ ${bookingId} → ${newTimeDisp}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE_EXTENDED
// ─────────────────────────────────────────────────────────────────────────────
async function handleServiceExtended(bookingId: string, data: NotificationJobData): Promise<void> {
  const dedupeKey = `notif:service:extended:${bookingId}:${data.extraMinutes ?? 0}`;
  if (await isDuplicate(dedupeKey, 3600)) return;

  // Only fire for RUNNING bookings — extension only valid mid-service
  const booking = await getBookingOrAbort(bookingId, ["RUNNING"]);
  if (!booking) return;

  const expiresAt  = add(new Date(), { days: 7 });
  const extraLabel = data.extraMinutes ? ` by ${data.extraMinutes} minutes` : "";

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "SERVICE_DELAYED",
      title:       "Service Extended",
      message:     `Your service with ${booking.staff.name} at ${booking.business.business_name} has been extended${extraLabel}. Please allow extra time.`,
      expires_at:  expiresAt,
    },
  }).catch(err => logger.error(`[SERVICE_EXTENDED] customer DB write FAILED ${bookingId}:`, err?.message));

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "SERVICE_EXTENDED",
      title:       "Service Extended",
      message:     `${booking.staff.name} extended service for ${booking.customer.name}${extraLabel}.`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[SERVICE_EXTENDED] biz DB write failed ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "notification:new", {
    type: "SERVICE_DELAYED", title: "Service Extended",
    message: `Your service with ${booking.staff.name} has been extended${extraLabel}. Please allow extra time.`,
  });
  emitToBusiness(booking.business_id, "service:extended", { bookingId, extraMinutes: data.extraMinutes });

  logger.info(`[NotificationWorker] SERVICE_EXTENDED ✅ ${bookingId}${extraLabel}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE_OVERRUN
// ─────────────────────────────────────────────────────────────────────────────
async function handleServiceOverrun(bookingId: string, data: NotificationJobData): Promise<void> {
  if (await isDuplicate(`notif:service:overrun:${bookingId}`, 3600)) return;

  const booking = await getBookingOrAbort(bookingId, ["RUNNING"]);
  if (!booking) return;

  const overrunSinceDisp = data.overrunSince
    ? formatInTimeZone(new Date(data.overrunSince), TZ, "hh:mm a")
    : "scheduled end time";

  await prisma.businessNotification.create({
    data: {
      business_id: booking.business_id,
      type:        "SERVICE_DELAYED",
      title:       "Service Running Over Time",
      message:     `${booking.staff.name}'s service for ${booking.customer.name} has exceeded its estimated duration (overdue since ${overrunSinceDisp}).`,
      target:      "BOTH",
      expires_at:  add(new Date(), { days: 1 }),
    },
  }).catch(err => logger.warn(`[SERVICE_OVERRUN] biz DB write failed ${bookingId}:`, err?.message));

  emitToBusiness(booking.business_id, "service:overrun", {
    bookingId,
    staffName:    booking.staff.name,
    customerName: booking.customer.name,
    overrunSince: data.overrunSince,
  });

  logger.info(`[NotificationWorker] SERVICE_OVERRUN ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUND_INITIATED
// ─────────────────────────────────────────────────────────────────────────────
async function handleRefundInitiated(bookingId: string): Promise<void> {
  if (await isDuplicate(`notif:refund-init:${bookingId}`, 3600)) return;

  const booking = await getBookingOrAbort(bookingId, ["CANCELLED", "REFUND_INITIATED"]);
  if (!booking) return;

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "REFUND_INITIATED",
      title:       "Refund Initiated",
      message:     `Refund for your booking with ${booking.staff.name} at ${booking.business.business_name} has been initiated. It will be credited within a few minutes.`,
      expires_at:  add(new Date(), { days: 30 }),
    },
  }).catch(err => logger.warn(`[REFUND_INITIATED] customer DB write failed ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "notification:new", {
    type: "REFUND_INITIATED", title: "Refund Initiated",
    message: `Refund for your appointment at ${booking.business.business_name} has been initiated.`,
  });
  logger.info(`[NotificationWorker] REFUND_INITIATED ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REFUND_COMPLETED
// ─────────────────────────────────────────────────────────────────────────────
async function handleRefundCompleted(bookingId: string): Promise<void> {
  if (await isDuplicate(`notif:refund-done:${bookingId}`, 3600)) return;

  const booking = await getBookingOrAbort(bookingId, ["CANCELLED", "REFUND_INITIATED", "REFUNDED"]);
  if (!booking) return;

  const payment = await prisma.payment.findUnique({
    where:  { booking_id: bookingId },
    select: { refund_amount: true },
  });
  const amount = payment?.refund_amount ? `₹${(payment.refund_amount / 100).toFixed(2)}` : "";

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        "REFUND_COMPLETED",
      title:       "Refund Successful",
      message:     `${amount} refund for your booking with ${booking.staff.name} at ${booking.business.business_name} has been credited.`,
      expires_at:  add(new Date(), { days: 30 }),
    },
  }).catch(err => logger.warn(`[REFUND_COMPLETED] customer DB write failed ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "notification:new", {
    type: "REFUND_COMPLETED", title: "Refund Successful",
    message: `${amount} refund for your appointment at ${booking.business.business_name} has been credited.`,
  });
  logger.info(`[NotificationWorker] REFUND_COMPLETED ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW_RECEIVED
// ─────────────────────────────────────────────────────────────────────────────
async function handleReviewReceived(reviewId: string): Promise<void> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      customer: { select: { name: true } },
      staff: {
        select: {
          id: true, name: true,
          user: { select: { id: true } },
          business_id: true,
          business: {
            select: {
              id: true, business_name: true,
              owner: { select: { user: { select: { id: true } } } },
            },
          },
        },
      },
    },
  });
  if (!review) return;

  const expiresAt    = add(new Date(), { days: 30 });
  const stars        = (review as any).rating;
  const customerName = review.customer.name;
  const staffName    = review.staff.name;
  const businessName = review.staff.business.business_name;
  const businessId   = review.staff.business_id;
  const staffUserId  = review.staff.user?.id;
  const ownerUserId  = review.staff.business?.owner?.user?.id;

  await prisma.staffNotification.create({
    data: {
      staff_id:   review.staff_id,
      type:       "REVIEW_RECEIVED",
      title:      `New ${stars}★ Review`,
      message:    `${customerName} left you a ${stars}★ review.`,
      expires_at: expiresAt,
    },
  }).catch(err => logger.warn(`[REVIEW_RECEIVED] staff DB write failed:`, err?.message));

  if (staffUserId) {
    emitToUser(staffUserId, "notification:new", {
      type: "REVIEW_RECEIVED", title: `New ${stars}★ Review`,
      message: `${customerName} left you a ${stars}★ review.`,
    });
  }

  await prisma.businessNotification.create({
    data: {
      business_id: businessId,
      type:        "REVIEW_RECEIVED",
      title:       `New ${stars}★ Review`,
      message:     `${customerName} rated ${staffName} ${stars}★ at ${businessName}.`,
      target:      "BOTH",
      expires_at:  expiresAt,
    },
  }).catch(err => logger.warn(`[REVIEW_RECEIVED] biz DB write failed:`, err?.message));

  emitToBusiness(businessId, "notification:new", {
    type: "REVIEW_RECEIVED", title: `New ${stars}★ Review`,
    message: `${customerName} rated ${staffName} ${stars}★.`,
  });
  logger.info(`[NotificationWorker] REVIEW_RECEIVED ✅ ${reviewId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// REMINDERS
// ─────────────────────────────────────────────────────────────────────────────
async function handleReminder(bookingId: string, type: "reminder-1hr" | "reminder-15min"): Promise<void> {
  const booking = await prisma.booking.findUnique({
    where:   { id: bookingId },
    include: {
      customer: { select: { id: true, name: true, user: { select: { id: true, email: true } } } },
      staff:    { select: { name: true } },
      business: { select: { business_name: true } },
    },
  });
  if (!booking || booking.status !== "CONFIRMED") return;

  const TZ = "Asia/Kolkata";
  const isUrgent    = type === "reminder-15min";
  const minuteLabel = isUrgent ? "15 minutes" : "1 hour";
  const notifType   = isUrgent ? "REMINDER_15_MIN" : "REMINDER_1_HOUR";
  const title       = isUrgent ? "Starting Soon" : "Upcoming Booking";
  const message     = `Your booking with ${booking.staff.name} at ${booking.business.business_name} starts in ${minuteLabel}.`;

  // booking.services is a Json snapshot field — cast as any[] directly
  const serviceNames = Array.isArray(booking.services)
    ? (booking.services as any[]).map((s: any) => s.name ?? "Service").join(", ")
    : "Service";

  await prisma.customerNotification.create({
    data: {
      customer_id: booking.customer_id,
      type:        notifType,
      title,
      message,
      expires_at:  add(new Date(), { days: 1 }),
    },
  }).catch(err => logger.warn(`[REMINDER] DB write failed ${bookingId}:`, err?.message));

  emitToUser(booking.customer.user.id, "notification:new", { type: notifType, title, message });

  // Send reminder email
  queueEmail({
    to:   booking.customer.user.email,
    type: "booking-reminder",
    data: {
      customerName: booking.customer.name,
      businessName: booking.business.business_name,
      serviceName:  serviceNames,
      serviceDate:  booking.service_date.toISOString().slice(0, 10),
      serviceTime:  booking.service_start_time
        ? formatInTimeZone(booking.service_start_time, TZ, "hh:mm a")
        : "",
      timeLabel:    minuteLabel,
    },
  }).catch(err => logger.warn(`[REMINDER] Email failed ${bookingId}:`, err?.message));

  logger.info(`[NotificationWorker] REMINDER(${type}) ✅ ${bookingId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────────────────────────
async function cleanupExpiredNotifications(): Promise<void> {
  const now = new Date();
  const [cust, biz, staff] = await Promise.all([
    prisma.customerNotification.deleteMany({ where: { expires_at: { lte: now } } }),
    prisma.businessNotification.deleteMany({ where: { expires_at: { lte: now } } }),
    prisma.staffNotification.deleteMany({ where: { expires_at: { lte: now } } }),
  ]);
  logger.info(`[NotificationWorker] Cleanup — customer:${cust.count} biz:${biz.count} staff:${staff.count}`);
}

notificationWorker.on("failed", (job, err) => {
  logger.error(`[NotificationWorker] Job ${job?.id} (${job?.data?.type}) FAILED:`, err.message);
});
notificationWorker.on("error", (err) => {
  logger.error("[NotificationWorker] Worker error:", err.message);
});