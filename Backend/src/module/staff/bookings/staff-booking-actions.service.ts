import { prisma } from "../../../config/prisma";
import { escrowQueue, notificationQueue, analyticsQueue } from "../../../config/bullmq";
import { emitToUser, emitToBusiness } from "../../../socket/socket.service";
import { BusinessAttendanceService } from "../../business/attendance/business-attendance.service";
import { add, addMinutes, differenceInMinutes } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";

const IST = "Asia/Kolkata";

function toIST(d: Date): string {
  return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

async function resolveStaff(userId: string) {
  const staff = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, name: true, business_id: true, user_id: true },
  });
  if (!staff) throw new NotFoundError("Staff profile not found.");
  return staff;
}

export class StaffBookingActionsService {

  static async scanBooking(
    userId:    string,
    bookingId: string,
    qrId:      string,
    scanMethod: "CAMERA" | "MANUAL" = "CAMERA",
  ) {
    const staff = await resolveStaff(userId);
    const now   = new Date();

    const booking = await prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        qr_code:  true,
        customer: { select: { id: true, name: true, user: { select: { id: true, email: true } } } },
        business: { select: { id: true, business_name: true, auth_user_id: true } },
      },
    });

    if (!booking)              throw new NotFoundError("Booking not found.");
    if (booking.staff_id !== staff.id) throw new ForbiddenError("This booking is not assigned to you.");
    if (!booking.qr_code)      throw new BadRequestError("No QR code found for this booking.");

    const qr = booking.qr_code;

    if (qr.qr_code_id !== qrId) {
      await prisma.qrScanLog.create({
        data: {
          booking_id:  bookingId,
          qr_code_id:  qr.id,
          staff_id:    staff.id,
          scan_result: "INVALID_QR_ID",
          scan_method: scanMethod,
        },
      }).catch(() => {});
      throw new BadRequestError("QR ID does not match this booking.");
    }

    const scanAbsoluteStart = booking.scan_absolute_start
      ?? addMinutes(booking.arrival_window_start, -5);
    const scanAbsoluteEnd   = booking.scan_absolute_end
      ?? addMinutes(booking.arrival_window_start, 15);

    if (now < scanAbsoluteStart) {
      await prisma.qrScanLog.create({
        data: {
          booking_id:  bookingId,
          qr_code_id:  qr.id,
          staff_id:    staff.id,
          scan_result: "TOO_EARLY",
          scan_method: scanMethod,
        },
      }).catch(() => {});
      throw new BadRequestError(
        `Too early to scan. Check-in opens at ${toIST(scanAbsoluteStart)}.`
      );
    }

    if (now > scanAbsoluteEnd || qr.qr_status === "CANCELLED") {
      await prisma.$transaction(async (tx) => {
        
        if (booking.status === "CONFIRMED") {
          await tx.booking.update({
            where: { id: bookingId },
            data:  { status: "CANCELLED_NO_SHOW", cancelled_at: now },
          });
        }
        await tx.qRCode.update({
          where: { id: qr.id },
          data:  { qr_status: "EXPIRED", is_used: true, used_at: now },
        });
        await tx.qrScanLog.create({
          data: {
            booking_id:  bookingId,
            qr_code_id:  qr.id,
            staff_id:    staff.id,
            scan_result: "EXPIRED",
            scan_method: scanMethod,
          },
        });
      });
      throw new BadRequestError("QR scan window has expired. Booking marked as no-show.");
    }

    if (qr.qr_status === "USED" || qr.is_used) {
      await prisma.qrScanLog.create({
        data: {
          booking_id:  bookingId,
          qr_code_id:  qr.id,
          staff_id:    staff.id,
          scan_result: "ALREADY_USED",
          scan_method: scanMethod,
        },
      }).catch(() => {});
      throw new BadRequestError("This QR code has already been scanned.");
    }

    if (!["CONFIRMED", "CHECKED_IN"].includes(booking.status)) {
      throw new BadRequestError(`Cannot scan: booking status is ${booking.status}.`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data:  {
          status:              "RUNNING",
          service_start_actual: now,
          service_started_at:  now,   
          checked_in_at:       now,
        },
      });

      await tx.qRCode.update({
        where: { id: qr.id },
        data:  {
          qr_status:     "USED",
          is_used:       true,
          used_at:       now,
          used_by_staff: staff.id,
        },
      });

      await tx.qrScanLog.create({
        data: {
          booking_id:  bookingId,
          qr_code_id:  qr.id,
          staff_id:    staff.id,
          scan_result: "VALID",
          scan_method: scanMethod,
        },
      });
    });

    BusinessAttendanceService.markPresentFromBooking({
      staff_id:    staff.id,
      business_id: staff.business_id,
      date:        booking.service_date,
      booking_id:  bookingId,
    }).catch(err => logger.warn("[StaffBookingActions] Attendance failed:", err));

    const customerUserId = booking.customer.user.id;
    emitToUser(customerUserId, "service:checked_in", { bookingId });
    emitToBusiness(booking.business_id, "service:checked_in", {
      bookingId,
      staffId:      staff.id,
      customerName: booking.customer.name,
    });

    await prisma.staffNotification.create({
      data: {
        staff_id:   staff.id,
        type:       "CUSTOMER_CHECKED_IN",
        title:      "Customer Arrived",
        message:    `${booking.customer.name} checked in for booking #${booking.booking_number}. Service timer started.`,
        expires_at: add(new Date(), { hours: 24 }), 
      },
    }).catch(() => {});

    logger.info(`[StaffBookingActions] Scan accepted — booking ${bookingId} → RUNNING`);

    return {
      booking_id: bookingId,
      status:     "IN_PROGRESS",
      message:    "Booking scanned. Service started.",
    };
  }

  static async completeBooking(userId: string, bookingId: string) {
    const staff = await resolveStaff(userId);
    const now   = new Date();

    const booking = await prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        customer: { select: { id: true, name: true, user: { select: { id: true, email: true } } } },
        business: { select: { id: true, business_name: true, auth_user_id: true } },
        escrow:   { select: { id: true, status: true } },
      },
    });

    if (!booking)              throw new NotFoundError("Booking not found.");
    if (booking.staff_id !== staff.id) throw new ForbiddenError("This booking is not assigned to you.");

    const serviceStartActual = booking.service_start_actual ?? booking.service_started_at;
    if (!serviceStartActual) {
      throw new BadRequestError(
        "Service has not started yet. Scan the QR code first."
      );
    }

    if (!["RUNNING", "CHECKED_IN", "IN_PROGRESS"].includes(booking.status)) {
      throw new BadRequestError(`Cannot complete: booking status is ${booking.status}.`);
    }

    const staffTakenTime = differenceInMinutes(now, serviceStartActual);

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data:  {
          status:               "COMPLETED",
          service_end_actual:   now,
          service_completed_at: now,    
          staff_taken_time:     staffTakenTime,
          actual_duration:      staffTakenTime,
        },
      });
    });

    if (booking.escrow && booking.escrow.status === "HELD") {
      escrowQueue.add(
        `release-escrow:${bookingId}`,
        { bookingId },
        { delay: 0, jobId: `release-escrow:${bookingId}` }
      ).catch(err => logger.warn("[StaffBookingActions] Escrow queue failed:", err));
    }

    notificationQueue.add(
      `booking-completed:${bookingId}`,
      { bookingId, type: "booking-completed" } as any,
      { jobId: `booking-completed:${bookingId}` }
    ).catch(() => {});

    analyticsQueue.add(
      `booking-completed:${bookingId}`,
      {
        type:       "booking-completed",
        bookingId,
        staffId:    staff.id,
        businessId: booking.business_id,
      },
      { jobId: `analytics:booking-completed:${bookingId}` },
    ).catch(() => {});

    const customerUserId = booking.customer.user.id;
    emitToUser(customerUserId, "service:completed", { bookingId });
    emitToBusiness(booking.business_id, "service:completed", { bookingId, staffId: staff.id });

    StaffBookingActionsService.updatePerformance(
      staff.id,
      booking.estimated_duration,
      staffTakenTime,
    ).catch(() => {});

    logger.info(
      `[StaffBookingActions] Completed booking ${bookingId} — staffTakenTime: ${staffTakenTime} min`
    );

    return {
      booking_id: bookingId,
      status:     "COMPLETED",
      message:    "Booking completed.",
    };
  }

  static async getPerformanceSummary(userId: string, period: "week" | "month" | "year") {
    const staff = await resolveStaff(userId);

    const since = period === "week"
      ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      : period === "month"
        ? new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        : new Date(new Date().getFullYear(), 0, 1);

    const result = await prisma.booking.aggregate({
      where: {
        staff_id:     staff.id,
        status:       "COMPLETED",
        service_date: { gte: since },
        staff_taken_time:    { not: null },
      },
      _avg: {
        estimated_duration: true,
        staff_taken_time:   true,
        actual_duration:    true,
      },
      _count: { id: true },
      _sum:   { staff_taken_time: true },
    });

    const avgExpected = result._avg.estimated_duration ?? 0;
    const avgActual   = result._avg.staff_taken_time   ?? 0;

    const extraResult = await prisma.booking.aggregate({
      where: {
        staff_id:     staff.id,
        status:       "COMPLETED",
        service_date: { gte: since },
        staff_taken_time: { not: null },
      },
      _sum: { staff_taken_time: true, estimated_duration: true },
    });
    const sumActual    = extraResult._sum.staff_taken_time   ?? 0;
    const sumEstimated = extraResult._sum.estimated_duration ?? 0;
    return {
      total_bookings:                result._count.id,
      completed:                     result._count.id,
      accuracy_percent:              avgExpected > 0 ? Math.min(100, Math.round((avgExpected / (avgActual || 1)) * 100)) : 100,
      avg_estimated_minutes:         Math.round(avgExpected),
      avg_actual_minutes:            Math.round(avgActual),
      extra_time_taken_total_minutes: Math.max(0, sumActual - sumEstimated),
    };
  }

  private static async updatePerformance(
    staffId:  string,
    estimated: number,
    actual:    number,
  ): Promise<void> {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const isOnTime   = actual <= estimated + 5;
    const delayAmt   = Math.max(0, actual - estimated);
    const efficiency = estimated > 0
      ? Math.min(100, Math.round((estimated / actual) * 100))
      : 100;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.staffPerformance.findUnique({
        where: { staff_id_month: { staff_id: staffId, month: monthStart } },
      });

      if (existing) {
        const newTotal    = existing.total_bookings + 1;
        const newEstMins  = existing.total_estimated_minutes + estimated;
        const newActMins  = existing.total_actual_minutes    + actual;
        const newOnTime   = existing.on_time_count  + (isOnTime ? 1 : 0);
        const newDelayed  = existing.delayed_count  + (isOnTime ? 0 : 1);
        const newAvgDelay = newDelayed > 0
          ? Math.round((existing.avg_delay_minutes * existing.delayed_count + delayAmt) / newDelayed)
          : 0;
        const newAvgEff   = Math.round(
          (existing.average_efficiency * existing.total_bookings + efficiency) / newTotal
        );

        await tx.staffPerformance.update({
          where: { id: existing.id },
          data: {
            total_bookings:           newTotal,
            total_estimated_minutes:  newEstMins,
            total_actual_minutes:     newActMins,
            average_efficiency:       newAvgEff,
            on_time_count:            newOnTime,
            delayed_count:            newDelayed,
            avg_delay_minutes:        newAvgDelay,
          },
        });
      } else {
        await tx.staffPerformance.create({
          data: {
            staff_id:                staffId,
            month:                   monthStart,
            total_bookings:          1,
            total_estimated_minutes: estimated,
            total_actual_minutes:    actual,
            average_efficiency:      efficiency,
            on_time_count:           isOnTime ? 1 : 0,
            delayed_count:           isOnTime ? 0 : 1,
            avg_delay_minutes:       isOnTime ? 0 : delayAmt,
          },
        });
      }
    });
  }
}