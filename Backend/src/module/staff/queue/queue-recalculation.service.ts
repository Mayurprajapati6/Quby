import { prisma } from "../../../config/prisma";
import { redisClient } from "../../../config/redis";
import { emitToUser } from "../../../socket/socket.service";
import { queueEmail } from "../../../services/email.services";
import { add, format, isAfter, set } from "date-fns";
import {
  BadRequestError,
  NotFoundError,
  UnauthorizedError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";

const MAX_DELAY_MINUTES = 30;

export interface DelayResult {
  bookings_shifted:   number;
  delay_minutes:      number;
  affected_customers: string[];
}

export class QueueRecalculationService {

  static async reportDelay(
    bookingId:    string,
    staffId:      string,
    delayMinutes: number,
  ): Promise<DelayResult> {

    if (delayMinutes < 1 || delayMinutes > MAX_DELAY_MINUTES) {
      throw new BadRequestError(
        `Delay must be between 1 and ${MAX_DELAY_MINUTES} minutes.`
      );
    }

    const currentBooking = await prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        business: {
          include: {
            schedules: true,
            owner: { select: { user: { select: { id: true } } } },
          },
        },
        staff: { select: { id: true, name: true } },
      },
    });

    if (!currentBooking) throw new NotFoundError("Booking not found.");
    if (currentBooking.staff_id !== staffId) {
      throw new UnauthorizedError("This booking does not belong to you.");
    }
    if (!["CHECKED_IN", "IN_PROGRESS", "RUNNING"].includes(currentBooking.status)) {
      throw new BadRequestError(
        "Can only report delay on a booking that is currently in progress."
      );
    }

    const serviceDate = currentBooking.service_date;
    const date        = format(serviceDate, "yyyy-MM-dd");

    const subsequentBookings = await prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: serviceDate,
        status:       "CONFIRMED",
        queue_number: { gt: currentBooking.queue_number },
      },
      include: {
        customer: {
          select: {
            id:   true,
            name: true,
            user: { select: { id: true, email: true } },
          },
        },
      },
      orderBy: { queue_number: "asc" },
    });

    if (subsequentBookings.length === 0) {
      logger.info(
        `[QueueRecalc] No subsequent bookings to shift for staff ${staffId} on ${date}`
      );

      await this.notifyBusinessOfDelay(
        currentBooking.business_id,
        currentBooking.business,
        currentBooking.staff.name,
        delayMinutes,
        0,
      );

      return { bookings_shifted: 0, delay_minutes: delayMinutes, affected_customers: [] };
    }

    const dow         = format(serviceDate, "EEEE").toUpperCase();
    const daySchedule = currentBooking.business.schedules.find(
      (s: any) => s.day_of_week === dow
    );

    const maxAllowedEnd = daySchedule
      ? add(
          set(serviceDate, {
            hours:   parseInt((daySchedule as any).close_time.split(":")[0]),
            minutes: parseInt((daySchedule as any).close_time.split(":")[1]),
          }),
          { hours: 1 }
        )
      : null;

    const affectedCustomerIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const booking of subsequentBookings) {
        const newArrivalStart    = add(booking.arrival_window_start, { minutes: delayMinutes });
        const newArrivalEnd      = add(booking.arrival_window_end,   { minutes: delayMinutes });
        const newServiceStart    = add(booking.service_start_time,   { minutes: delayMinutes });
        const newServiceEnd      = add(booking.service_end_time,     { minutes: delayMinutes });
        const newScanAbsStart    = add(booking.scan_absolute_start,    { minutes: delayMinutes });
        const newScanRecommEnd   = add(booking.scan_recommended_end,   { minutes: delayMinutes });
        const newScanAbsEnd      = add(booking.scan_absolute_end,      { minutes: delayMinutes });
        const newServiceExpStart = add(booking.service_start_expected, { minutes: delayMinutes });
        const newServiceExpEnd   = add(booking.service_end_expected,   { minutes: delayMinutes });

        if (maxAllowedEnd && isAfter(newServiceEnd, maxAllowedEnd)) {
          logger.warn(
            `[QueueRecalc] Booking ${booking.id} (queue #${booking.queue_number}) ` +
            `would exceed business hours after shift — skipping`
          );
          continue;
        }

        await tx.booking.update({
          where: { id: booking.id },
          data:  {
            arrival_window_start:   newArrivalStart,
            arrival_window_end:     newArrivalEnd,
            service_start_time:     newServiceStart,
            service_end_time:       newServiceEnd,
            scan_absolute_start:    newScanAbsStart,
            scan_recommended_end:   newScanRecommEnd,
            scan_absolute_end:      newScanAbsEnd,
            service_start_expected: newServiceExpStart,
            service_end_expected:   newServiceExpEnd,
          },
        });

        await tx.escrowTransaction.updateMany({
          where: { booking_id: booking.id, status: "HELD" },
          data:  { scheduled_release_at: add(newServiceEnd, { minutes: 60 }) },
        });

        await tx.qRCode.updateMany({
          where: { booking_id: booking.id, qr_status: "ACTIVE" },
          data:  {
            valid_from: newScanAbsStart,
            expires_at: newScanAbsEnd,
          },
        });

        affectedCustomerIds.push(booking.customer.id);

        await tx.customerNotification.create({
          data: {
            customer_id: booking.customer.id,
            type:        "SERVICE_DELAYED",
            title:       "Your appointment time has been updated",
            message:
              `Your appointment with ${currentBooking.staff.name} has been delayed ` +
              `by ${delayMinutes} minutes. ` +
              `New arrival window: ${format(newArrivalStart, "h:mm a")} – ` +
              `${format(newArrivalEnd, "h:mm a")}.`,
            expires_at: add(new Date(), { days: 30 }),
          },
        });
      }
    });

    await this.invalidateAvailabilityCache(staffId, date);

    for (const booking of subsequentBookings) {
      if (!affectedCustomerIds.includes(booking.customer.id)) continue;

      const updatedBooking = await prisma.booking.findUnique({
        where:  { id: booking.id },
        select: { arrival_window_start: true, arrival_window_end: true, service_end_time: true },
      });
      if (!updatedBooking) continue;

      emitToUser(booking.customer.user.id, "service:delayed", {
        bookingId:     booking.id,
        bookingNumber: booking.booking_number,
        delayMinutes,
        newArrivalWindow: {
          start: format(updatedBooking.arrival_window_start, "h:mm a"),
          end:   format(updatedBooking.arrival_window_end,   "h:mm a"),
        },
        newServiceEndTime: format(updatedBooking.service_end_time, "h:mm a"),
        staffName:    currentBooking.staff.name,
        businessName: currentBooking.business.business_name,
        message:
          `Your appointment has been delayed by ${delayMinutes} minutes. ` +
          `New arrival: ${format(updatedBooking.arrival_window_start, "h:mm a")} – ` +
          `${format(updatedBooking.arrival_window_end, "h:mm a")}`,
      });

      queueEmail({
        to:   booking.customer.user.email,
        type: "service-delayed",
        data: {
          customerName:  booking.customer.name,
          businessName:  currentBooking.business.business_name,
          delayMinutes,
          newTime:       format(updatedBooking.arrival_window_start, "h:mm a"),
        },
      }).catch(() => {});
    }

    if (affectedCustomerIds.length > 0) {
      await this.notifyBusinessOfDelay(
        currentBooking.business_id,
        currentBooking.business,
        currentBooking.staff.name,
        delayMinutes,
        affectedCustomerIds.length,
      );
    }

    logger.info(
      `[QueueRecalc] Shifted ${affectedCustomerIds.length} bookings by ${delayMinutes} min ` +
      `for staff ${staffId} on ${date}`
    );

    return {
      bookings_shifted:   affectedCustomerIds.length,
      delay_minutes:      delayMinutes,
      affected_customers: affectedCustomerIds,
    };
  }

  private static async notifyBusinessOfDelay(
    businessId:       string,
    business:         any,
    staffName:        string,
    delayMinutes:     number,
    affectedCount:    number,
  ): Promise<void> {
    const message = affectedCount > 0
      ? `${staffName} reported a ${delayMinutes}-min delay. ${affectedCount} upcoming booking(s) shifted.`
      : `${staffName} reported a ${delayMinutes}-min delay. No upcoming bookings were affected.`;

    await prisma.businessNotification.create({
      data: {
        business_id: businessId,
        type:        "SERVICE_DELAYED",
        title:       "Service Delay Reported",
        message,
        target:      "BOTH",
        expires_at:  add(new Date(), { days: 7 }),
      },
    }).catch(() => {});

    const ownerUserId = business?.owner?.user?.id;
    if (ownerUserId) {
      emitToUser(ownerUserId, "service:delayed", {
        businessId,
        staffName,
        delayMinutes,
        affectedCount,
        message,
      });
    }

    const saloonUserId = business?.auth_user_id;
    if (saloonUserId) {
      emitToUser(saloonUserId, "service:delayed", {
        businessId,
        staffName,
        delayMinutes,
        affectedCount,
        message,
      });
    }
  }

  private static async invalidateAvailabilityCache(
    staffId: string,
    date:    string
  ): Promise<void> {
    try {
      const keys = [
        `staff:status:${staffId}`,
        `staff:${staffId}:availability:${date}`,
        `availability:${staffId}:${date}`,
      ];
      await Promise.all(keys.map((k) => redisClient.del(k)));
    } catch (err) {
      logger.error("[QueueRecalc] Cache invalidation failed:", err);
    }
  }

  static async rebuildRedisQueue(staffId: string, date: string): Promise<void> {
    const bookings = await prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: new Date(date),
        status:       { in: ["CONFIRMED", "PENDING_PAYMENT", "CHECKED_IN", "IN_PROGRESS"] },
      },
      orderBy: { queue_number: "asc" },
    });

    if (bookings.length === 0) return;

    const redisKey = `queue:staff:${staffId}:${date}`;

    const args: (string | number)[] = [];
    for (const b of bookings) {
      args.push(b.queue_number, b.id);
    }
    await (redisClient as any).zadd(redisKey, ...args);

    const nextMidnight = set(add(new Date(date), { days: 1 }), {
      hours: 0, minutes: 0, seconds: 0, milliseconds: 0,
    });
    await redisClient.expireat(redisKey, Math.floor(nextMidnight.getTime() / 1000));

    logger.info(
      `[QueueRecalc] Rebuilt Redis queue for staff ${staffId} on ${date} — ${bookings.length} bookings`
    );
  }
}