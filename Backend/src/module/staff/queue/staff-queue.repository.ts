import { prisma } from "../../../config/prisma";
import { startOfDay, addMinutes } from "date-fns";

const BOOKING_INCLUDE = {
  customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
  qr_code:  { select: { qr_code_id: true, qr_image_url: true, is_used: true, expires_at: true } },
} as const;

export class StaffQueueRepository {

  static async findTodayQueue(staffId: string) {
    const today = startOfDay(new Date());

    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: today,
        status:       { in: ["CHECKED_IN", "IN_PROGRESS", "RUNNING", "CONFIRMED"] },
      },
      include: BOOKING_INCLUDE,
      orderBy: { queue_number: "asc" },
    });
  }

  static async findQueueByDate(staffId: string, date: Date) {
    const day = startOfDay(date);

    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: day,
        status:       { notIn: ["PENDING_PAYMENT"] },
      },
      include: {
        customer: { select: { id: true, name: true, avatar_url: true } },
      },
      orderBy: { queue_number: "asc" },
    });
  }

  static async findBookingByQrCodeId(qrCodeId: string) {
    const qr = await prisma.qRCode.findUnique({
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
    return qr;
  }

  static async findBookingById(bookingId: string, staffId: string) {
    return prisma.booking.findFirst({
      where:   { id: bookingId, staff_id: staffId },
      include: {
        customer: {
          select: { id: true, name: true, user: { select: { id: true, email: true } } },
        },
        business: {
          select: { id: true, business_name: true },
        },
        escrow: {
          select: { id: true, scheduled_release_at: true, amount: true },
        },
      },
    });
  }

  static async markCheckedIn(bookingId: string, staffId: string) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.qRCode.updateMany({
        where: { booking_id: bookingId },
        data:  { is_used: true, used_at: now, used_by_staff: staffId },
      });

      return tx.booking.update({
        where: { id: bookingId },
        data:  {
          status:            "CHECKED_IN",
          checked_in_at:     now,
          service_start_time: now,     
          service_started_at: now,     
        },
      });
    });
  }

  static async markInProgress(bookingId: string) {
    const now = new Date();
    return prisma.booking.update({
      where: { id: bookingId },
      data:  { status: "IN_PROGRESS", service_started_at: now },
    });
  }

  static async markCompleted(bookingId: string) {
    const now = new Date();
    return prisma.booking.update({
      where: { id: bookingId },
      data:  {
        status:               "COMPLETED",
        service_completed_at: now,
        actual_duration:      undefined,  
      },
    });
  }

  static async markCompleteWithDuration(bookingId: string, actualDuration: number) {
    const now = new Date();
    return prisma.booking.update({
      where: { id: bookingId },
      data:  {
        status:               "COMPLETED",
        service_completed_at: now,
        service_end_actual:   now,
        actual_duration:      actualDuration,
        staff_taken_time:     actualDuration,  
      },
    });
  }

  static async getSubsequentBookings(staffId: string, serviceDate: Date, afterQueueNumber: number) {
    return prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: startOfDay(serviceDate),
        status:       { in: ["CONFIRMED", "RUNNING", "IN_PROGRESS", "CHECKED_IN"] },
        queue_number: { gt: afterQueueNumber },
      },
      select: {
        id:                   true,
        booking_number:       true,
        customer_id:          true,
        queue_number:         true,
        arrival_window_start: true,
        arrival_window_end:   true,
        service_start_time:   true,
        service_end_time:     true,
        customer: { select: { id: true, user: { select: { id: true } } } },
        escrow: { select: { id: true, scheduled_release_at: true } },
      },
      orderBy: { queue_number: "asc" },
    });
  }

  static async shiftBookingTimes(
    bookingId: string,
    data: {
      arrival_window_start: Date;
      arrival_window_end:   Date;
      service_start_time:   Date;
      service_end_time:     Date;
    },
  ) {
    const { arrival_window_start, arrival_window_end, service_end_time } = data;
    const slotStart = arrival_window_end ?? arrival_window_start; 
    const scan_absolute_start  = slotStart;
    const scan_recommended_end = addMinutes(slotStart, 10);
    const scan_absolute_end    = addMinutes(slotStart, 10);

    const updated = await prisma.booking.update({
      where: { id: bookingId },
      data: {
        ...data,
        scan_absolute_start,
        scan_recommended_end,
        scan_absolute_end,
        service_start_expected: scan_absolute_end,
        service_end_expected:   service_end_time,
      },
    });

    await prisma.qRCode.updateMany({
      where: { booking_id: bookingId, qr_status: "ACTIVE" },
      data:  {
        valid_from: scan_absolute_start,
        expires_at: scan_absolute_end,
      },
    }).catch(() => {}); 

    return updated;
  }

  static async createCustomerNotification(customerId: string, title: string, message: string) {
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

  static async recalculateQueueNumbers(
    staffId:             string,
    serviceDate:         Date,
    cancelledQueueNumber: number,
  ): Promise<void> {
    await prisma.$executeRaw`
      UPDATE bookings
      SET    queue_number = queue_number - 1
      WHERE  staff_id      = ${staffId}
        AND  service_date  = ${startOfDay(serviceDate)}
        AND  queue_number  > ${cancelledQueueNumber}
        AND  status        IN ('CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'RUNNING')
    `;
  }
}