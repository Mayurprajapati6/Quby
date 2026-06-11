/**
 * staff/queue/staff-queue.repository.ts
 *
 * Clean repository — no derived time fields stored.
 * All arrival_window, service_end_time derived at read time.
 */

import { prisma } from "../../../config/prisma";
import { startOfDay, addMinutes } from "date-fns";
import { BadRequestError } from "../../../utils/errors/app.error";

const BOOKING_INCLUDE = {
  customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
} as const;

export class StaffQueueRepository {

  // ─────────────────────────────────────────────────────────────────────────────
  // findTodayQueue
  // Returns RUNNING + CONFIRMED bookings for today (IST-aware date window).
  // ─────────────────────────────────────────────────────────────────────────────
  static async findTodayQueue(staffId: string) {
    const now = new Date();
    const istDateStr = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const today = new Date(istDateStr + "T00:00:00+05:30");
    const end   = new Date(istDateStr + "T23:59:59+05:30");

    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: { gte: today, lte: end },
        status:       { in: ["RUNNING", "CONFIRMED"] },
        is_visible:   { not: false },
      },
      include: BOOKING_INCLUDE,
      orderBy: { queue_number: "asc" },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // findQueueByDate — any calendar date, all statuses (no ghost bookings)
  // ─────────────────────────────────────────────────────────────────────────────
  static async findQueueByDate(staffId: string, date: Date) {
    const day = startOfDay(date);
    const end = new Date(day);
    end.setDate(end.getDate() + 1);

    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: { gte: day, lt: end },
        status:       { notIn: ["PENDING_PAYMENT", "EXPIRED"] },
        is_visible:   { not: false },
      },
      include: {
        customer: { select: { id: true, name: true, avatar_url: true } },
      },
      orderBy: { queue_number: "asc" },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // findBookingByQrCodeId
  // ─────────────────────────────────────────────────────────────────────────────
  static async findBookingByQrCodeId(qrCodeId: string) {
    return prisma.qRCode.findUnique({
      where:   { qr_code_id: qrCodeId },
      include: {
        booking: {
          include: {
            customer: {
              select: {
                id: true, name: true, phone: true,
                user: { select: { id: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // findBookingById — scoped to staff
  // ─────────────────────────────────────────────────────────────────────────────
  static async findBookingById(bookingId: string, staffId: string) {
    return prisma.booking.findFirst({
      where: { id: bookingId, staff_id: staffId },
      include: {
        customer: {
          select: {
            id: true, name: true, phone: true, avatar_url: true,
            user: { select: { id: true, email: true } },
          },
        },
        business: { select: { id: true, business_name: true } },
        payment:  { select: { id: true, status: true } },
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // startService — QR scan path (atomic: mark QR used + booking RUNNING)
  // ─────────────────────────────────────────────────────────────────────────────
  static async startService(bookingId: string, staffId: string) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.qRCode.updateMany({
        where: { booking_id: bookingId, is_used: false },
        data:  { is_used: true, used_at: now, used_by_staff: staffId },
      });

      if (updated.count === 0) {
        throw new BadRequestError("QR already used.");
      }

      return tx.booking.update({
        where: { id: bookingId },
        data:  {
          status:             "RUNNING",
          checked_in_at:      now,
          service_started_at: now,   // Actual start = QR scan time
        },
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // markCompleteWithDuration — complete with actual time measurement
  // ─────────────────────────────────────────────────────────────────────────────
  static async markCompleteWithDuration(bookingId: string, actualDuration: number) {
    const now = new Date();
    return prisma.booking.update({
      where: { id: bookingId },
      data:  {
        status:               "COMPLETED",
        service_completed_at: now,
        actual_duration:      actualDuration,
        staff_taken_time:     actualDuration,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // getSubsequentBookings — all CONFIRMED/RUNNING bookings after a queue position
  // ─────────────────────────────────────────────────────────────────────────────
  static async getSubsequentBookings(
    staffId:            string,
    serviceDate:        Date,
    afterQueueNumber:   number,
  ) {
    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: startOfDay(serviceDate),
        status:       { in: ["CONFIRMED", "RUNNING"] },
        queue_number: { gt: afterQueueNumber },
      },
      select: {
        id:                 true,
        booking_number:     true,
        customer_id:        true,
        queue_number:       true,
        service_start_time: true,
        estimated_duration: true,
        customer: {
          select: {
            id:   true,
            name: true,
            user: { select: { id: true } },
          },
        },
      },
      orderBy: { queue_number: "asc" },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // shiftBookingTimes — update service_start_time only (single source of truth)
  // Derived fields (arrival_window, service_end) are computed at read time.
  // ─────────────────────────────────────────────────────────────────────────────
  static async shiftBookingTime(bookingId: string, newServiceStartTime: Date) {
    return prisma.booking.update({
      where: { id: bookingId },
      data:  { service_start_time: newServiceStartTime },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // createCustomerNotification — SERVICE_DELAYED notification for a customer
  // ─────────────────────────────────────────────────────────────────────────────
  static async createCustomerNotification(
    customerId: string,
    title:      string,
    message:    string,
  ) {
    return prisma.customerNotification.create({
      data: {
        customer_id: customerId,
        type:        "SERVICE_DELAYED",
        title,
        message,
        expires_at:  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    }).catch(() => {});
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // recalculateQueueNumbers — compact queue numbers after a cancellation
  // ─────────────────────────────────────────────────────────────────────────────
  static async recalculateQueueNumbers(
    staffId:              string,
    serviceDate:          Date,
    cancelledQueueNumber: number,
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE bookings
      SET    queue_number = queue_number - 1
      WHERE  staff_id      = ${staffId}
        AND  service_date  = ${startOfDay(serviceDate)}
        AND  queue_number  > ${cancelledQueueNumber}
        AND  status        IN ('CONFIRMED', 'RUNNING')
    `;
  }
}
