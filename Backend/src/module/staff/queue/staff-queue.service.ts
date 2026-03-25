import { prisma } from "../../../config/prisma";
import { StaffQueueRepository } from "./staff-queue.repository";
import { emitToUser, emitToBusiness } from "../../../socket/socket.service";
import { queueEmail } from "../../../services/email.services";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { formatInTimeZone } from "date-fns-tz";
import { addMinutes } from "date-fns";
import { BusinessAttendanceService } from "../../business/attendance/business-attendance.service";
import { invalidateSlotCache } from "../../../utils/cache/slotCache";
import { bookingQueue, escrowQueue, analyticsQueue } from "../../../config/bullmq";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

const RUNNING = new Set(["CHECKED_IN", "IN_PROGRESS", "RUNNING"]);

function toQueueItem(b: any) {
  return {
    id:                   b.id,
    booking_number:       b.booking_number,
    queue_number:         b.queue_number,
    status:               b.status,
    arrival_window_start: toIST(b.arrival_window_start),
    arrival_window_end:   toIST(b.arrival_window_end),
    service_start_time:   toIST(b.service_start_time),
    service_end_time:     toIST(b.service_end_time),
    checked_in_at:        b.checked_in_at     ? toIST(b.checked_in_at)     : null,
    service_started_at:   b.service_started_at ? toIST(b.service_started_at) : null,
    estimated_duration:   b.estimated_duration,
    services:             Array.isArray(b.services) ? b.services.map((s: any) => s.name ?? "") : [],
    customer: {
      id:         b.customer.id,
      name:       b.customer.name,
      phone:      b.customer.phone      ?? null,
      avatar_url: b.customer.avatar_url ?? null,
    },
    qr_code: (b as any).qr_code
      ? {
          qr_code_id:   (b as any).qr_code.qr_code_id,
          qr_image_url: (b as any).qr_code.qr_image_url,
          is_used:      (b as any).qr_code.is_used,
          expires_at:   toIST((b as any).qr_code.expires_at),
        }
      : null,
  };
}

export class StaffQueueService {

  private static async resolveStaff(userId: string) {
    const staff = await prisma.staff.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true, business_id: true, is_active: true },
    });
    if (!staff)          throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
    return staff;
  }

  static async getTodayQueue(userId: string) {
    const staff    = await this.resolveStaff(userId);
    const bookings = await StaffQueueRepository.findTodayQueue(staff.id);

    const running  = bookings.filter(b => RUNNING.has(b.status)).map(toQueueItem);
    const upcoming = bookings.filter(b => b.status === "CONFIRMED").map(toQueueItem);

    return { running, upcoming, staff_id: staff.id };
  }

  static async getQueueByDate(userId: string, dateStr: string) {
    const staff = await this.resolveStaff(userId);
    const date  = new Date(`${dateStr}T00:00:00+05:30`);
    if (isNaN(date.getTime())) throw new BadRequestError("Invalid date. Use YYYY-MM-DD.");

    const bookings = await StaffQueueRepository.findQueueByDate(staff.id, date);

    return bookings.map(b => ({
      id:             b.id,
      booking_number: b.booking_number,
      queue_number:   b.queue_number,
      status:         b.status,
      service_date:   toISTDate(b.service_date),
      service_start_time: toIST(b.arrival_window_start),
      services:       Array.isArray(b.services) ? b.services.map((s: any) => s.name ?? "") : [],
      customer_name:  (b as any).customer.name,
    }));
  }

  static async scanQr(userId: string, qrCodeId: string) {
    const staff = await this.resolveStaff(userId);
    const qr    = await StaffQueueRepository.findBookingByQrCodeId(qrCodeId);

    if (!qr) throw new NotFoundError("QR code not found.");

    const booking = qr.booking;

    if (booking.staff_id !== staff.id) {
      throw new ForbiddenError("This QR code is not assigned to you.");
    }
    if (qr.is_used) {
      throw new BadRequestError("This QR code has already been scanned.");
    }
    if (booking.status !== "CONFIRMED") {
      throw new BadRequestError(`Cannot check in: booking is ${booking.status}.`);
    }

    const now = new Date();

    const scanStart = new Date(booking.arrival_window_end);                 
    const scanEnd   = booking.scan_absolute_end ?? addMinutes(scanStart, 10);

    if (now < scanStart) {
      throw new BadRequestError(
        `Too early to scan. QR is valid from ${toIST(scanStart)} (your slot start time).`
      );
    }

    if (now > qr.expires_at) {
      await prisma.booking.update({
        where: { id: booking.id },
        data:  { status: "CANCELLED_NO_SHOW", cancelled_at: now },
      }).catch(() => {});
      throw new BadRequestError("QR code has expired. Booking marked as no-show.");
    }

    await StaffQueueRepository.markCheckedIn(booking.id, staff.id);

    const customerUserId = (booking as any).customer?.user?.id;
    if (customerUserId) {
      emitToUser(customerUserId, "service:checked_in", { bookingId: booking.id });
    }

    emitToBusiness(staff.business_id, "service:checked_in", {
      bookingId:    booking.id,
      staffId:      staff.id,
      customerName: (booking as any).customer.name,
    });

    return {
      booking_id:     booking.id,
      booking_number: booking.booking_number,
      customer_name:  (booking as any).customer.name,
      status:         "CHECKED_IN",
    };
  }

  static async completeService(userId: string, bookingId: string) {
    const staff   = await this.resolveStaff(userId);
    const booking = await StaffQueueRepository.findBookingById(bookingId, staff.id);
    if (!booking) throw new NotFoundError("Booking not found.");

    if (!["CHECKED_IN", "IN_PROGRESS", "RUNNING"].includes(booking.status)) {
      throw new BadRequestError(`Cannot complete a booking with status: ${booking.status}.`);
    }

    const scanTime       = booking.checked_in_at ?? new Date();
    const actualMinutes  = Math.round((new Date().getTime() - scanTime.getTime()) / 60000);
    const scanWindowStart = (booking as any).scan_absolute_start ?? (booking as any).arrival_window_end;
    const slotEnd         = (booking as any).service_end_time;
    const estimatedFromSlot = scanWindowStart && slotEnd
      ? Math.round((new Date(slotEnd).getTime() - new Date(scanWindowStart).getTime()) / 60000)
      : booking.estimated_duration;

    await StaffQueueRepository.markCompleteWithDuration(bookingId, actualMinutes);

    BusinessAttendanceService.markPresentFromBooking({
      staff_id:    staff.id,
      business_id: staff.business_id,
      date:        booking.service_date,
      booking_id:  bookingId,
    }).catch(err => logger.warn("[StaffQueue] Attendance mark failed:", err));

    const customerUserId = (booking as any).customer?.user?.id;
    if (customerUserId) {
      emitToUser(customerUserId, "service:completed", { bookingId });
      queueEmail({
        to:   (booking as any).customer.user.email,
        type: "service-completed",
        data: {
          customerName:  (booking as any).customer.name,
          businessName:  (booking as any).business?.business_name ?? "",
          bookingNumber: booking.booking_number,
          staffName:     staff.name,
          serviceName:   Array.isArray((booking as any).services)
            ? (booking as any).services.map((s: any) => s.name ?? "").join(", ")
            : "",
          duration:      actualMinutes,
        },
      }).catch(err => logger.warn("[StaffQueue] Complete email failed:", err));
    }

    emitToBusiness(staff.business_id, "service:completed", {
      bookingId,
      staffId: staff.id,
    });

    StaffQueueService.updateStaffPerformance(
      staff.id,
      estimatedFromSlot,   
      actualMinutes,       
    ).catch(() => {});

    invalidateSlotCache(
      staff.id,
      booking.service_date.toISOString().slice(0, 10),
    ).catch(() => {});

    analyticsQueue.add(
      `booking-completed:${bookingId}`,
      { type: "booking-completed", bookingId, staffId: staff.id, businessId: staff.business_id },
      { jobId: `analytics:booking-completed:${bookingId}` },
    ).catch(() => {});

    return { booking_id: bookingId, status: "COMPLETED", actual_duration_minutes: actualMinutes };
  }

  private static async updateStaffPerformance(
    staffId:           string,
    estimatedMinutes:  number,
    actualMinutes:     number,
  ): Promise<void> {
    try {
      const now        = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const isOnTime    = actualMinutes <= estimatedMinutes + 5;
      const delayAmount = Math.max(0, actualMinutes - estimatedMinutes);

      const efficiency = estimatedMinutes > 0
        ? Math.min(100, Math.round((estimatedMinutes / actualMinutes) * 100))
        : 100;

      await prisma.$transaction(async (tx) => {
        const existing = await tx.staffPerformance.findUnique({
          where: { staff_id_month: { staff_id: staffId, month: monthStart } },
        });

        if (existing) {
          const newTotal   = existing.total_bookings + 1;
          const newEstMins = existing.total_estimated_minutes + estimatedMinutes;
          const newActMins = existing.total_actual_minutes    + actualMinutes;
          const newOnTime  = existing.on_time_count  + (isOnTime ? 1 : 0);
          const newDelayed = existing.delayed_count  + (isOnTime ? 0 : 1);
          const newAvgDelay = newDelayed > 0
            ? Math.round((existing.avg_delay_minutes * existing.delayed_count + delayAmount) / newDelayed)
            : 0;
          const newAvgEff  = Math.round(
            (existing.average_efficiency * existing.total_bookings + efficiency) / newTotal
          );

          await tx.staffPerformance.update({
            where: { id: existing.id },
            data:  {
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
              total_estimated_minutes: estimatedMinutes,
              total_actual_minutes:    actualMinutes,
              average_efficiency:      efficiency,
              on_time_count:           isOnTime ? 1 : 0,
              delayed_count:           isOnTime ? 0 : 1,
              avg_delay_minutes:       isOnTime ? 0 : delayAmount,
            },
          });
        }
      });

      logger.info(`[StaffQueue] Performance updated for staff ${staffId} — efficiency: ${efficiency}%`);
    } catch (err) {
      
      logger.warn("[StaffQueue] StaffPerformance update failed (non-fatal):", err);
    }
  }

  static async extendService(userId: string, bookingId: string, extraMinutes: number) {
    if (extraMinutes < 1 || extraMinutes > 60) {
      throw new BadRequestError("extra_minutes must be between 1 and 60.");
    }

    const staff   = await this.resolveStaff(userId);
    const booking = await StaffQueueRepository.findBookingById(bookingId, staff.id);
    if (!booking) throw new NotFoundError("Booking not found.");

    if (!["CHECKED_IN", "IN_PROGRESS", "RUNNING"].includes(booking.status)) {
      throw new BadRequestError("Can only extend a booking that is currently in progress.");
    }

    const business = await prisma.business.findUnique({
      where:  { id: staff.business_id },
      select: {
        id:            true,
        business_name: true,
        auth_user_id:  true,
        owner: { select: { user: { select: { id: true } } } },
      },
    });

    const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    const dow  = days[new Date(booking.service_date).getDay()];
    const schedule = await prisma.businessSchedule.findFirst({
      where:  { business_id: staff.business_id, day_of_week: dow as any },
      select: { close_time: true },
    });

    const newServiceEnd = addMinutes(booking.service_end_time, extraMinutes);
    const notifExpiry   = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    let closingTimeWarning = false;
    const checkCloseTime = (t: Date) => {
      if (!schedule?.close_time) return;
      const [ch, cm] = schedule.close_time.split(":").map(Number);
      const closeTime = new Date(booking.service_date);
      closeTime.setHours(ch, cm, 0, 0);
      if (t > closeTime) closingTimeWarning = true;
    };
    checkCloseTime(newServiceEnd);

    const subsequent = await StaffQueueRepository.getSubsequentBookings(
      staff.id, booking.service_date, booking.queue_number,
    );
    if (subsequent.length > 0) {
      checkCloseTime(addMinutes(subsequent[subsequent.length - 1].service_end_time, extraMinutes));
    }

    const currentEscrowReleaseAt = (booking as any).escrow?.scheduled_release_at;
    const newEscrowReleaseAt = currentEscrowReleaseAt
      ? addMinutes(new Date(currentEscrowReleaseAt), extraMinutes)  
      : addMinutes(newServiceEnd, 60);                              

    await prisma.$transaction(async (tx) => {
      await tx.booking.update({
        where: { id: bookingId },
        data: {
          service_end_time:      newServiceEnd,
          service_end_expected:  newServiceEnd,
          estimated_duration:    booking.estimated_duration + extraMinutes,
          total_duration:        booking.total_duration     + extraMinutes,
        },
      });

      await tx.escrowTransaction.updateMany({
        where: { booking_id: bookingId, status: "HELD" },
        data:  { scheduled_release_at: newEscrowReleaseAt },
      });
    });

    const currentEscrowDelay = newEscrowReleaseAt.getTime() - Date.now();
    if (currentEscrowDelay > 0) {
      await escrowQueue.getJob(`escrow:${bookingId}`).then(j => j?.remove()).catch(() => {});
      await escrowQueue.add(
        `escrow:${bookingId}`,
        { bookingId, businessId: staff.business_id, staffId: staff.id },
        { delay: currentEscrowDelay, jobId: `escrow:${bookingId}`, attempts: 3 },
      ).catch(() => {});
    }

    if (subsequent.length > 0) {
      await Promise.all(
        subsequent.map(b =>
          StaffQueueRepository.shiftBookingTimes(b.id, {
            arrival_window_start: addMinutes(b.arrival_window_start, extraMinutes),
            arrival_window_end:   addMinutes(b.arrival_window_end,   extraMinutes),
            service_start_time:   addMinutes(b.service_start_time,   extraMinutes),
            service_end_time:     addMinutes(b.service_end_time,      extraMinutes),
          })
        )
      );

      await Promise.all(
        subsequent.map(async b => {
          const existingRelease = (b as any).escrow?.scheduled_release_at;
          const newRelease = existingRelease
            ? addMinutes(new Date(existingRelease), extraMinutes)
            : addMinutes(b.service_end_time, extraMinutes + 5);
          await prisma.escrowTransaction.updateMany({
            where: { booking_id: b.id, status: "HELD" },
            data:  { scheduled_release_at: newRelease },
          }).catch(() => {});
          const delay = newRelease.getTime() - Date.now();
          if (delay > 0) {
            await escrowQueue.getJob(`escrow:${b.id}`).then(j => j?.remove()).catch(() => {});
            await escrowQueue.add(
              `escrow:${b.id}`,
              { bookingId: b.id, businessId: staff.business_id, staffId: staff.id },
              { delay, jobId: `escrow:${b.id}`, attempts: 3 },
            ).catch(() => {});
          }
        })
      );

      await Promise.allSettled(
        subsequent.map(async b => {
          const newScanEnd = addMinutes(b.arrival_window_end, extraMinutes + 10);
          const noShowDelay = newScanEnd.getTime() - Date.now();
          if (noShowDelay > 0) {
            await bookingQueue.getJob(`no-show:${b.id}`).then(j => j?.remove()).catch(() => {});
            await bookingQueue.add(
              `no-show:${b.id}`,
              { bookingId: b.id, event: "no-show" },
              { delay: noShowDelay, jobId: `no-show:${b.id}`, attempts: 1 }
            ).catch(() => {});
          }
        })
      );

      const customerMsg = (b: any) =>
        `Your appointment with ${staff.name} at ${business?.business_name ?? "the salon"} ` +
        `has been shifted by ${extraMinutes} min. ` +
        `New arrival window: ${toIST(addMinutes(b.arrival_window_start, extraMinutes))}.`;

      await Promise.allSettled(
        subsequent.map(async b => {
          const customerUserId = (b as any).customer?.user?.id;
          if (customerUserId) {
            emitToUser(customerUserId, "service:delayed", {
              bookingId:             b.id,
              bookingNumber:         b.booking_number,
              staffName:             staff.name,
              businessName:          business?.business_name,
              delayMinutes:          extraMinutes,
              reason:                "service_extended",
              newArrivalWindowStart: toIST(addMinutes(b.arrival_window_start, extraMinutes)),
              newServiceStart:       toIST(addMinutes(b.service_start_time,   extraMinutes)),
            });

            await prisma.customerNotification.create({
              data: {
                customer_id: (b as any).customer_id ?? "",
                type:        "QUEUE_SHIFTED",
                title:       `Queue shifted +${extraMinutes} min`,
                message:     customerMsg(b),
                expires_at:  notifExpiry,
              },
            }).catch(() => {});
          }
        })
      );
    }

    const bizMsg = `${staff.name} added ${extraMinutes} extra min to booking #${(booking as any).booking_number}. ` +
                   `${subsequent.length} downstream booking(s) shifted.`;

    await prisma.businessNotification.create({
      data: {
        business_id: staff.business_id,
        type:        "SERVICE_EXTENDED",
        title:       `⏱ Extra Time Added by ${staff.name}`,
        message:     bizMsg,
        target:      "BOTH",
        expires_at:  notifExpiry,
      },
    }).catch(() => {});

    emitToBusiness(staff.business_id, "queue:updated", {
      staffId:         staff.id,
      staffName:       staff.name,
      extraMinutes,
      bookingsShifted: subsequent.length,
      reason:          "service_extended",
      message:         bizMsg,
    });

    if (business?.auth_user_id) {
      emitToUser(business.auth_user_id, "queue:updated", {
        staffId: staff.id, staffName: staff.name, extraMinutes, bookingsShifted: subsequent.length,
      });
    }

    const ownerUserId = business?.owner?.user?.id;
    if (ownerUserId) {
      const ownerMsg = `${staff.name} (${business?.business_name}) added ${extraMinutes} extra min to a service. ` +
                       `${subsequent.length} customer(s) notified of queue shift.`;

      await prisma.businessNotification.create({
        data: {
          business_id: staff.business_id,
          type:        "SERVICE_EXTENDED",
          title:       `⏱ ${staff.name} Extended Service`,
          message:     ownerMsg,
          target:      "OWNER",
          expires_at:  notifExpiry,
        },
      }).catch(() => {});

      emitToUser(ownerUserId, "queue:updated", {
        staffId:      staff.id,
        staffName:    staff.name,
        businessName: business?.business_name,
        extraMinutes,
        bookingsShifted: subsequent.length,
        message:      ownerMsg,
      });
    }

    logger.info(`[StaffQueue] Extended booking ${bookingId} by ${extraMinutes} min, shifted ${subsequent.length} downstream`);

    return {
      booking_id:           bookingId,
      extra_minutes:        extraMinutes,
      new_service_end_time: toIST(newServiceEnd),
      bookings_shifted:     subsequent.length,
      closing_time_warning: closingTimeWarning
        ? "One or more bookings may now extend past salon closing time. Please inform affected customers."
        : null,
    };
  }

  static async reportDelay(userId: string, bookingId: string, delayMinutes: number) {
    if (delayMinutes < 1 || delayMinutes > 120) {
      throw new BadRequestError("delay_minutes must be between 1 and 120.");
    }

    const staff   = await this.resolveStaff(userId);
    const booking = await StaffQueueRepository.findBookingById(bookingId, staff.id);
    if (!booking) throw new NotFoundError("Booking not found.");

    if (!["CHECKED_IN", "IN_PROGRESS", "RUNNING"].includes(booking.status)) {
      throw new BadRequestError("Can only report delay on a booking currently in progress.");
    }

    const business = await prisma.business.findUnique({
      where:  { id: staff.business_id },
      select: {
        id:            true,
        business_name: true,
        auth_user_id:  true,
        owner: { select: { user: { select: { id: true } } } },
      },
    });

    const notifExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const subsequent = await StaffQueueRepository.getSubsequentBookings(
      staff.id,
      booking.service_date,
      booking.queue_number,
    );

    if (subsequent.length === 0) {
      const noDownstreamMsg = `${staff.name} reported a ${delayMinutes}-min delay. No downstream bookings affected.`;
      await prisma.businessNotification.create({
        data: {
          business_id: staff.business_id,
          type:        "SERVICE_DELAYED",
          title:       `⏳ ${staff.name} Reported Delay`,
          message:     noDownstreamMsg,
          target:      "BOTH",
          expires_at:  notifExpiry,
        },
      }).catch(() => {});
      emitToBusiness(staff.business_id, "queue:updated", {
        staffId: staff.id, staffName: staff.name, delayMinutes, bookingsShifted: 0,
      });
      return { bookings_shifted: 0, delay_minutes: delayMinutes, closing_time_warning: null };
    }

    let closingTimeWarning = false;
    const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
    const dow  = days[new Date(booking.service_date).getDay()];
    const schedule = await prisma.businessSchedule.findFirst({
      where:  { business_id: staff.business_id, day_of_week: dow as any },
      select: { close_time: true },
    });
    if (schedule?.close_time) {
      const [ch, cm] = schedule.close_time.split(":").map(Number);
      const closeTime = new Date(booking.service_date);
      closeTime.setHours(ch, cm, 0, 0);
      const lastBooking = subsequent[subsequent.length - 1];
      if (addMinutes(lastBooking.service_end_time, delayMinutes) > closeTime) {
        closingTimeWarning = true;
      }
    }

    await Promise.all(
      subsequent.map(b =>
        StaffQueueRepository.shiftBookingTimes(b.id, {
          arrival_window_start: addMinutes(b.arrival_window_start, delayMinutes),
          arrival_window_end:   addMinutes(b.arrival_window_end,   delayMinutes),
          service_start_time:   addMinutes(b.service_start_time,   delayMinutes),
          service_end_time:     addMinutes(b.service_end_time,      delayMinutes),
        })
      )
    );

    await Promise.all(
      subsequent.map(async b => {
        const existingRelease = (b as any).escrow?.scheduled_release_at;
        const newRelease = existingRelease
          ? addMinutes(new Date(existingRelease), delayMinutes)
          : addMinutes(b.service_end_time, delayMinutes + 5);
        await prisma.escrowTransaction.updateMany({
          where: { booking_id: b.id, status: "HELD" },
          data:  { scheduled_release_at: newRelease },
        }).catch(() => {});
        const delay = newRelease.getTime() - Date.now();
        if (delay > 0) {
          await escrowQueue.getJob(`escrow:${b.id}`).then(j => j?.remove()).catch(() => {});
          await escrowQueue.add(
            `escrow:${b.id}`,
            { bookingId: b.id, businessId: staff.business_id, staffId: staff.id },
            { delay, jobId: `escrow:${b.id}`, attempts: 3 },
          ).catch(() => {});
        }
      })
    );

    await Promise.allSettled(
      subsequent.map(async b => {
        const newScanEnd = addMinutes(b.arrival_window_end, delayMinutes + 10);
        const noShowDelay = newScanEnd.getTime() - Date.now();
        if (noShowDelay > 0) {
          await bookingQueue.getJob(`no-show:${b.id}`).then(j => j?.remove()).catch(() => {});
          await bookingQueue.add(
            `no-show:${b.id}`,
            { bookingId: b.id, event: "no-show" },
            { delay: noShowDelay, jobId: `no-show:${b.id}`, attempts: 1 }
          ).catch(() => {});
        }
      })
    );

    await Promise.allSettled(
      subsequent.map(async b => {
        const customerUserId = (b as any).customer?.user?.id;
        if (customerUserId) {
          emitToUser(customerUserId, "service:delayed", {
            bookingId:             b.id,
            bookingNumber:         b.booking_number,
            staffName:             staff.name,
            businessName:          business?.business_name,
            delayMinutes,
            reason:                "staff_reported_delay",
            newArrivalWindowStart: toIST(addMinutes(b.arrival_window_start, delayMinutes)),
            newServiceStart:       toIST(addMinutes(b.service_start_time,   delayMinutes)),
          });

          await prisma.customerNotification.create({
            data: {
              customer_id: (b as any).customer_id ?? "",
              type:        "QUEUE_SHIFTED",
              title:       `Queue shifted +${delayMinutes} min`,
              message:     `Your appointment with ${staff.name} at ${business?.business_name ?? "the salon"} ` +
                           `has been shifted by ${delayMinutes} min. ` +
                           `New arrival: ${toIST(addMinutes(b.arrival_window_start, delayMinutes))}.`,
              expires_at:  notifExpiry,
            },
          }).catch(() => {});
        }
      })
    );

    const bizMsg = `${staff.name} reported a ${delayMinutes}-min delay. ` +
                   `${subsequent.length} booking(s) shifted. Escrow timings updated.`;

    await prisma.businessNotification.create({
      data: {
        business_id: staff.business_id,
        type:        "SERVICE_DELAYED",
        title:       `⏳ ${staff.name} Reported Delay`,
        message:     bizMsg,
        target:      "BOTH",
        expires_at:  notifExpiry,
      },
    }).catch(() => {});

    emitToBusiness(staff.business_id, "queue:updated", {
      staffId:         staff.id,
      staffName:       staff.name,
      businessName:    business?.business_name,
      delayMinutes,
      bookingsShifted: subsequent.length,
      reason:          "staff_reported_delay",
      message:         bizMsg,
    });

    if (business?.auth_user_id) {
      emitToUser(business.auth_user_id, "queue:updated", {
        staffId: staff.id, staffName: staff.name, delayMinutes, bookingsShifted: subsequent.length,
      });
    }

    const ownerUserId = business?.owner?.user?.id;
    if (ownerUserId) {
      const ownerMsg = `${staff.name} (${business?.business_name}) reported a ${delayMinutes}-min delay. ` +
                       `${subsequent.length} customer(s) queue shifted and notified.`;

      await prisma.businessNotification.create({
        data: {
          business_id: staff.business_id,
          type:        "SERVICE_DELAYED",
          title:       `⏳ ${staff.name} Delay — ${business?.business_name}`,
          message:     ownerMsg,
          target:      "OWNER",
          expires_at:  notifExpiry,
        },
      }).catch(() => {});

      emitToUser(ownerUserId, "queue:updated", {
        staffId:      staff.id,
        staffName:    staff.name,
        businessName: business?.business_name,
        delayMinutes,
        bookingsShifted: subsequent.length,
        message:      ownerMsg,
      });
    }

    return {
      bookings_shifted:     subsequent.length,
      delay_minutes:        delayMinutes,
      closing_time_warning: closingTimeWarning
        ? "One or more bookings may now extend past salon closing time."
        : null,
    };
  }
}