import QRCode      from "qrcode";
import crypto      from "crypto";
import { prisma }  from "../../config/prisma";
import { PaymentRepository } from "./payment.repository";
import { uploadRawBuffer }   from "../../utils/helpers/cloudinary";
import { emitToUser }        from "../../socket/socket.service";
import { queueEmail }        from "../../services/email.services";
import {
  settleQueue,
  notificationQueue,
  bookingQueue,
  analyticsQueue,
}                            from "../../config/bullmq";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
}                            from "../../utils/errors/app.error";
import logger                from "../../config/logger.config";
import { serverConfig }      from "../../config";
import { addMinutes }        from "date-fns";
import { formatInTimeZone }  from "date-fns-tz";
import { razorpay }          from "../../config/razorpay";
import { invalidateSlotCache } from "../../utils/cache/slotCache";
import {
  deriveScanWindowStart,
  deriveScanWindowEnd,
  deriveServiceEnd,
} from "../customer/booking/booking.repository";

const TZ = "Asia/Kolkata";

function toTZ(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

// ─── QR HMAC signing ─────────────────────────────────────────────────────────
function signQrPayload(payload: object): string {
  const body = JSON.stringify(payload);
  const sig  = crypto
    .createHmac("sha256", serverConfig.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  return JSON.stringify({ ...payload, _sig: sig });
}

export function verifyQrSignature(rawData: string): boolean {
  try {
    const obj            = JSON.parse(rawData) as Record<string, unknown>;
    const { _sig, ...rest } = obj;
    const expected       = crypto
      .createHmac("sha256", serverConfig.RAZORPAY_KEY_SECRET!)
      .update(JSON.stringify(rest))
      .digest("hex");
    return expected === _sig;
  } catch {
    return false;
  }
}

export class PaymentService {

  
  static async createOrder(bookingId: string, userId: string) {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const booking = await PaymentRepository.findBookingForPayment(bookingId);
    if (!booking) throw new NotFoundError("Booking not found.");
    if (booking.customer_id !== customer.id) throw new ForbiddenError("Access denied.");

    if (booking.status === "CONFIRMED") {
      throw new BadRequestError("This booking is already confirmed. No further payment needed.");
    }

    if (booking.status !== "PENDING_PAYMENT") {
      throw new BadRequestError(`Booking is in '${booking.status}' state — cannot create payment order.`);
    }

    const payment = await PaymentRepository.findPaymentByBooking(bookingId);
    if (!payment) throw new NotFoundError("Payment record not found.");

    if (payment.razorpay_order_id) {
      return {
        order_id:        payment.razorpay_order_id,
        amount:          payment.amount,
        currency:        "INR",
        booking_id:      bookingId,
        razorpay_key_id: serverConfig.RAZORPAY_KEY_ID,
        idempotent:      true,
      };
    }

    const order = await razorpay.orders.create({
      amount:   payment.amount,
      currency: "INR",
      receipt:  bookingId,
    });

    await PaymentRepository.updatePaymentOrderId(payment.id, order.id);

    return {
      order_id:        order.id,
      amount:          payment.amount,
      currency:        "INR",
      booking_id:      bookingId,
      razorpay_key_id: serverConfig.RAZORPAY_KEY_ID,
    };
  }

  static async verifyPayment(dto: {
    booking_id:          string;
    razorpay_order_id:   string;
    razorpay_payment_id: string;
    razorpay_signature:  string;
  }) {
    
    const expectedSig = crypto
      .createHmac("sha256", serverConfig.RAZORPAY_KEY_SECRET!)
      .update(`${dto.razorpay_order_id}|${dto.razorpay_payment_id}`)
      .digest("hex");

    if (expectedSig !== dto.razorpay_signature) {
      throw new BadRequestError("Invalid payment signature. Payment verification failed.");
    }

    // ── Load booking ──────────────────────────────────────────────────────────
    const booking = await PaymentRepository.findBookingWithRelations(dto.booking_id);
    if (!booking) throw new NotFoundError("Booking not found.");

    // ── Already CONFIRMED (webhook was faster, or duplicate call) ────────────
    if (booking.status === "CONFIRMED") {
      return {
        booking_id:    dto.booking_id,
        status:        "CONFIRMED",
        qr_image_url:  booking.qr_code?.qr_image_url ?? null,
        qr_expires_at: booking.qr_code?.expires_at
          ? toTZ(booking.qr_code.expires_at) : null,
        idempotent:    true,
      };
    }

    // ── Any other terminal state — genuine error ───────────────────────────────
    if (booking.status !== "PENDING_PAYMENT") {
      throw new BadRequestError(
        `Booking is in '${booking.status}' state — cannot process payment.`,
      );
    }

    const result = await this._confirmPaymentTransaction(booking, dto);

    if (!result) {
     
      const updated = await PaymentRepository.findBookingWithRelations(dto.booking_id);
      return {
        booking_id:    dto.booking_id,
        status:        "CONFIRMED",
        qr_image_url:  updated?.qr_code?.qr_image_url  ?? null,
        qr_expires_at: updated?.qr_code?.expires_at
          ? toTZ(updated.qr_code.expires_at) : null,
        idempotent:    true,
      };
    }

    return result;
  }

  static async _confirmPaymentTransaction(
    booking: any,
    dto: {
      razorpay_order_id:   string;
      razorpay_payment_id: string;
      razorpay_signature:  string;
    },
  ): Promise<{
    booking_id:    string;
    status:        string;
    qr_image_url:  string;
    qr_expires_at: string;
    idempotent?:   boolean;
  } | null> {

    const existingPayment = await prisma.payment.findUnique({
      where:  { booking_id: booking.id },
      select: { status: true },
    });
    if (existingPayment?.status === "PAID") {
      logger.info(`[Payment] _confirmPaymentTransaction: payment already PAID for booking ${booking.id}`);
      return null;
    }

    const now = new Date();

    const scanWindowStart = deriveScanWindowStart(booking.service_start_time);
    const scanWindowEnd   = deriveScanWindowEnd(booking.service_start_time);
    const serviceEndTime  = deriveServiceEnd(booking.service_start_time, booking.estimated_duration);
    const settleAfter     = addMinutes(serviceEndTime, 5);
    const qrExpiresAt     = scanWindowEnd;

    const windowHours      = booking.business?.cancellation_window_hours ?? 2;
    const cancellableUntil = new Date(scanWindowStart.getTime() - windowHours * 3_600_000);

    const serviceDateTZ = formatInTimeZone(new Date(booking.service_date), TZ, "yyyy-MM-dd");
    const services      = Array.isArray(booking.services)
      ? booking.services.map((s: any) => s.name ?? "")
      : [];

    const qrId      = crypto.randomUUID();
    const qrPayload = signQrPayload({ qr_id: qrId, booking_id: booking.id, ts: Date.now() });

    const qrBuffer = await QRCode.toBuffer(qrPayload, {
      type:                 "png",
      width:                400,
      errorCorrectionLevel: "H",
    });
    const qrUpload = await uploadRawBuffer(qrBuffer, "image/png", "QR_CODES");

    let raceLost = false;
    try {
      await prisma.$transaction(async (tx) => {

        const bookingUpdate = await tx.booking.updateMany({
          where: {
            id:      booking.id,
            status:  "PENDING_PAYMENT",
            version: booking.version,          
          },
          data: {
            status:               "CONFIRMED",
            version:              { increment: 1 },
            cancellable_until:    cancellableUntil,
            payment_confirmed_at: now,
          },
        });

        if (bookingUpdate.count === 0) {
          
          raceLost = true;
          throw new Error("__RACE_LOST__");  // triggers rollback
        }

        // Mark payment PAID
        await tx.payment.update({
          where: { booking_id: booking.id },
          data:  {
            status:              "PAID",
            paid_at:             now,
            razorpay_payment_id: dto.razorpay_payment_id,
            razorpay_order_id:   dto.razorpay_order_id,
            razorpay_signature:  dto.razorpay_signature,
            settle_after:        settleAfter,
          },
        });

        // Create QR record
        await tx.qRCode.create({
          data: {
            booking_id:   booking.id,
            qr_code_id:   qrId,
            qr_data:      qrPayload,
            qr_image_url: qrUpload.secure_url,
            issued_at:    now,
            valid_from:   scanWindowStart,
            expires_at:   qrExpiresAt,
            qr_status:    "ACTIVE",
            is_used:      false,
          },
        });

        // Upsert DailyQueue to reflect confirmed queue position
        await tx.dailyQueue.upsert({
          where: {
            staff_id_service_date: {
              staff_id:     booking.staff_id,
              service_date: booking.service_date,
            },
          },
          create: {
            staff_id:          booking.staff_id,
            service_date:      booking.service_date,
            last_queue_number: booking.queue_number,
          },
          update: {
            // Only advance counter if this booking's number is higher
            last_queue_number: booking.queue_number,
          },
        });

        // Audit trail
        await tx.bookingEvent.create({
          data: {
            booking_id: booking.id,
            event_type: "PAYMENT_PAID",
            event_data: {
              razorpay_payment_id: dto.razorpay_payment_id,
              amount:              booking.service_amount,
            },
          },
        });

      }); // end $transaction

    } catch (err: any) {
      if (err?.message === "__RACE_LOST__" || raceLost) {
        logger.warn(`[Payment] _confirmPaymentTransaction: race lost for booking ${booking.id}`);
        return null;
      }
      throw err;
    }

    invalidateSlotCache(
      booking.staff_id,
      formatInTimeZone(new Date(booking.service_date), TZ, "yyyy-MM-dd"),
    ).catch(() => {});

    // ── Schedule async jobs ───────────────────────────────────────────────────
    const safeId        = String(booking.id).replace(/:/g, "-");
    const settleDelay   = settleAfter.getTime()                              - Date.now();
    const noShowDelay   = scanWindowEnd.getTime()                            - Date.now();
    const oneHourBefore = new Date(booking.service_start_time).getTime() - 3_600_000 - Date.now();
    const fifteenBefore = new Date(booking.service_start_time).getTime() -   900_000 - Date.now();

    const jobPromises: Promise<any>[] = [];

    // Remove the payment-timeout job (booking is now confirmed, no longer needed)
    jobPromises.push(
      bookingQueue.getJob(`payment-timeout-${safeId}`)
        .then(j => j?.remove())
        .catch(() => {}),
    );

    if (settleDelay > 0) {
      jobPromises.push(
        settleQueue.add(
          `settle-${safeId}`,
          { bookingId: booking.id },
          { delay: settleDelay, jobId: `settle-${safeId}`, attempts: 5 },
        ).catch(err => logger.error("[Payment] settle job failed:", err)),
      );
    }

    if (noShowDelay > 0) {
      jobPromises.push(
        bookingQueue.add(
          `no-show-${safeId}`,
          { bookingId: booking.id, event: "no-show" },
          { delay: noShowDelay, jobId: `no-show-${safeId}`, attempts: 1 },
        ).catch(() => {}),
      );
    }

    if (oneHourBefore > 0) {
      jobPromises.push(
        notificationQueue.add(
          `reminder-1hr-${safeId}`,
          { bookingId: booking.id, type: "reminder-1hr" },
          { delay: oneHourBefore, jobId: `reminder-1hr-${safeId}` },
        ).catch(() => {}),
      );
    }

    if (fifteenBefore > 0) {
      jobPromises.push(
        notificationQueue.add(
          `reminder-15min-${safeId}`,
          { bookingId: booking.id, type: "reminder-15min" },
          { delay: fifteenBefore, jobId: `reminder-15min-${safeId}` },
        ).catch(() => {}),
      );
    }

    jobPromises.push(
      notificationQueue.add(
        `booking-created-${safeId}`,
        { bookingId: booking.id, type: "booking:created" },
        { jobId: `booking-created-${safeId}` },
      ).catch(() => {}),
    );

    jobPromises.push(
      analyticsQueue.add(
        `payment-received-${safeId}`,
        { type: "payment-received", bookingId: booking.id },
        { jobId: `analytics-payment-received-${safeId}` },
      ).catch(() => {}),
    );

    await Promise.allSettled(jobPromises);

    // ── Real-time socket event ────────────────────────────────────────────────
    emitToUser(booking.customer.user.id, "payment:confirmed", {
      bookingId:   booking.id,
      qrImageUrl:  qrUpload.secure_url,
      qrExpiresAt: toTZ(qrExpiresAt),
    });

    // ── Confirmation email (non-blocking) ─────────────────────────────────────
    queueEmail({
      to:   booking.customer.user.email,
      type: "booking-confirmation",
      data: {
        customerName:  booking.customer.name,
        businessName:  booking.business.business_name,
        staffName:     booking.staff.name,
        serviceDate:   serviceDateTZ,
        serviceTime:   formatInTimeZone(scanWindowStart, TZ, "hh:mm a"),
        arrivalWindow: toTZ(scanWindowStart),
        bookingNumber: booking.booking_number,
        serviceName:   services.join(", "),
        duration:      booking.estimated_duration ?? 0,
        totalAmount:   booking.service_amount     ?? 0,
        qrImageUrl:    qrUpload.secure_url,
        qrExpiresAt:   toTZ(qrExpiresAt),
      },
    }).catch(err => logger.warn("[Payment] Confirmation email failed:", err));

    return {
      booking_id:    booking.id,
      status:        "CONFIRMED",
      qr_image_url:  qrUpload.secure_url,
      qr_expires_at: toTZ(qrExpiresAt),
    };
  }

  static async handleWebhook(rawBody: Buffer, signature: string) {
    const expectedSig = crypto
      .createHmac("sha256", serverConfig.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    if (expectedSig !== signature) {
      throw new BadRequestError("Invalid webhook signature.");
    }

    const event = JSON.parse(rawBody.toString());
    logger.info(`[Webhook] Event: ${event.event}`);

    switch (event.event) {

      // ── payment.captured: customer paid (possibly tab was closed) ─────────
      case "payment.captured": {
        const orderId   = event.payload?.payment?.entity?.order_id;
        const paymentId = event.payload?.payment?.entity?.id;

        if (!orderId) {
          logger.warn("[Webhook] payment.captured missing order_id");
          break;
        }

        const payment = await prisma.payment.findUnique({
          where:  { razorpay_order_id: orderId },
          select: { id: true, status: true, booking_id: true },
        });

        if (!payment) {
          logger.warn(`[Webhook] No payment found for order ${orderId}`);
          break;
        }

        // ── Already PAID — pure duplicate, do nothing ─────────────────────
        if (payment.status === "PAID") {
          logger.info(`[Webhook] payment.captured: already PAID for order ${orderId}, skipping`);
          break;
        }

        // ── PENDING → confirm booking ────────────────────────────────────
        if (payment.status === "PENDING") {
          logger.info(`[Webhook] Auto-confirming booking ${payment.booking_id} via webhook`);

          const booking = await PaymentRepository.findBookingWithRelations(payment.booking_id);

          if (!booking) {
            logger.warn(`[Webhook] Booking ${payment.booking_id} not found`);
            break;
          }

          if (booking.status === "CONFIRMED") {
            // Frontend already confirmed it
            logger.info(`[Webhook] Booking ${payment.booking_id} already CONFIRMED`);
            break;
          }

          if (booking.status === "PENDING_PAYMENT") {
            await this._confirmPaymentTransaction(booking, {
              razorpay_order_id:   orderId,
              razorpay_payment_id: paymentId ?? orderId,
              razorpay_signature:  "webhook_auto",
            });
          } else {
            logger.warn(`[Webhook] Booking ${payment.booking_id} in unexpected status ${booking.status}`);
          }
        }
        break;
      }

      
      case "payment.failed": {
        const orderId    = event.payload?.payment?.entity?.order_id;
        const errorCode  = event.payload?.payment?.entity?.error_code ?? null;
        const errorDesc  = event.payload?.payment?.entity?.error_description ?? null;

        if (!orderId) break;

        await prisma.payment.updateMany({
          where: { razorpay_order_id: orderId },
          data:  { status: "FAILED" },
        }).catch(() => {});

        // Log event for observability (non-fatal)
        const paymentRecord = await prisma.payment.findUnique({
          where:  { razorpay_order_id: orderId },
          select: { booking_id: true },
        }).catch(() => null);

        if (paymentRecord?.booking_id) {
          await prisma.bookingEvent.create({
            data: {
              booking_id: paymentRecord.booking_id,
              event_type: "PAYMENT_FAILED",
              event_data: { razorpay_order_id: orderId, error_code: errorCode, error_description: errorDesc },
            },
          }).catch(() => {});

          // Emit to customer so UI can show failure immediately (if tab is open)
          const booking = await PaymentRepository.findBookingWithRelations(paymentRecord.booking_id).catch(() => null);
          if (booking?.customer?.user?.id) {
            emitToUser(booking.customer.user.id, "payment:failed", {
              bookingId:        paymentRecord.booking_id,
              errorCode,
              errorDescription: errorDesc,
              message:          "Payment failed. Please try again — your slot is still held.",
            });
          }
        }

        logger.info(`[Webhook] Payment failed for order ${orderId} — booking stays PENDING_PAYMENT for retry`);
        break;
      }

      // ── refund.processed / refund.created ────────────────────────────────
      case "refund.created": {
        const refund  = event.payload?.refund?.entity;
        const payment = event.payload?.payment?.entity;
        const paymentId = payment?.id ?? refund?.payment_id;

        if (!refund || !paymentId) {
          logger.warn("[Webhook] Missing refund/payment id in refund.created payload");
          break;
        }

        const { handleRefundWebhookCreated } = await import("../../workers/refund.worker");
        await handleRefundWebhookCreated(paymentId, refund.id, refund.amount);
        logger.info(`[Webhook] Refund created for payment ${paymentId}`);
        break;
      }

      case "refund.processed": {
        const refund  = event.payload?.refund?.entity;
        const payment = event.payload?.payment?.entity;
        const paymentId = payment?.id ?? refund?.payment_id;

        if (!refund || !paymentId) {
          logger.warn("[Webhook] Missing refund/payment id in refund.processed payload");
          break;
        }

        const { handleRefundWebhookConfirmed } = await import("../../workers/refund.worker");
        await handleRefundWebhookConfirmed(paymentId, refund.id, refund.amount);
        logger.info(`[Webhook] Refund handled for payment ${paymentId}`);
        break;
      }

      // ── refund.failed: refund attempt failed ──────────────────────────────
      case "refund.failed": {
        const refund = event.payload?.refund?.entity;
        const paymentId = refund?.payment_id;
        const orderId = refund?.order_id;
        if (!paymentId && !orderId) break;

        const paymentRecord = await prisma.payment.findFirst({
          where:  paymentId
            ? { razorpay_payment_id: paymentId }
            : { razorpay_order_id: orderId },
          select: { booking_id: true },
        }).catch(() => null);

        if (paymentRecord?.booking_id) {
          await prisma.$transaction([
            prisma.booking.update({
              where: { id: paymentRecord.booking_id },
              data:  { status: "CANCELLED" },
            }),
            prisma.payment.updateMany({
              where: paymentId
                ? { razorpay_payment_id: paymentId }
                : { razorpay_order_id: orderId },
              data:  { refund_status: "FAILED" },
            }),
          ]).catch(() => {});

          logger.error(`[Webhook] Refund FAILED for order ${orderId} — booking ${paymentRecord.booking_id} reverted to CANCELLED. Manual action required.`);
        }
        break;
      }

      default:
        logger.info(`[Webhook] Unhandled event: ${event.event}`);
    }
  }
}
