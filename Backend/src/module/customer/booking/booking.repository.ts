import { prisma } from "../../../config/prisma";
import { redisClient } from "../../../config/redis";
import { startOfDay, endOfDay, add } from "date-fns";
import { toZonedTime, formatInTimeZone } from "date-fns-tz";
import { v4 as uuid } from "uuid";
import {
  getSlotCache,
  setSlotCache,
} from "../../../utils/cache/slotCache";
import type {
  StaffSuggestionResponseDTO,
  SuggestedStaffItemDTO,
  PartialMatchStaffDTO,
} from "./booking.types";

const IST             = "Asia/Kolkata";
const RESERVATION_TTL = 600;   // 10 min
const BUFFER_MINUTES  = 5;     // gap between bookings

export interface SlotResult {
  staff_id:             string;
  staff_name:           string;
  avatar_url:           string | null;
  service_start_time:   Date;
  arrival_window_start: Date;
  arrival_window_end:   Date;
  service_end_time:     Date;
  estimated_duration:   number;
  total_duration:       number;
  queue_number:         number;
}

export interface ReservationData {
  customer_id:          string;
  business_id:          string;
  service_offering_ids: string[];
  service_date:         string;
  slots:                SlotResult[];
}

interface FindSlotsInput {
  business_id:          string;
  service_offering_ids: string[];
  service_date:         Date;
  preferred_staff_id?:  string;
  mode?:                "select" | "random";
}

function dowIST(date: Date): string {
  const zoned = toZonedTime(date, IST);
  const days  = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  return days[zoned.getDay()];
}

function toIST(d: Date): string {
  return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

export class BookingRepository {

  
  static async suggestStaff(
    business_id:          string,
    service_offering_ids: string[],
    service_date:         Date,
  ): Promise<StaffSuggestionResponseDTO> {

    const dayStart = startOfDay(service_date);
    const dayEnd   = endOfDay(service_date);
    const dow      = dowIST(service_date);
    const dateStr  = service_date.toISOString().slice(0, 10);
    const isToday  = startOfDay(new Date()).getTime() === dayStart.getTime();

    const holiday = await prisma.holiday.findFirst({
      where: {
        business_id,
        start_date:           { lte: dayEnd },
        end_date:             { gte: dayStart },
        applies_to_all_staff: true,
      },
    });
    if (holiday) {
      return {
        can_fully_serve: [],
        partial_matches: [],
        message: "The salon is closed on this date due to a holiday.",
        total_duration_min: 0,
        no_staff_reason: "holiday",
      };
    }

    const offeringDetails = await prisma.businessServiceOffering.findMany({
      where:   { id: { in: service_offering_ids }, business_id, is_active: true },
      include: { platform_service: { select: { name: true } } },
    });
    const offeringNameMap = new Map(offeringDetails.map(o => [o.id, o.platform_service.name]));

    const staffList = await prisma.staff.findMany({
      where: {
        business_id,
        is_active: true,
        services: {
          some: {
            service_offering: { id: { in: service_offering_ids }, is_active: true },
            is_available: true,
          },
        },
      },
      include: {
        schedules: { where: { day_of_week: dow as any, is_available: true } },
        leaves: {
          where: {
            status:     "APPROVED",
            start_date: { lte: dayEnd },
            end_date:   { gte: dayStart },
          },
        },
        services: {
          where: {
            is_available:     true,
            service_offering: { id: { in: service_offering_ids }, is_active: true },
          },
          include: {
            service_offering: {
              include: { platform_service: { select: { name: true } } },
            },
          },
        },
      },
    });

    const allStaffIds = staffList.map(s => s.id);
    const busyStaffIds: Set<string> = new Set();
    if (isToday && allStaffIds.length > 0) {
      const busyBookings = await prisma.booking.findMany({
        where: {
          staff_id:     { in: allStaffIds },
          service_date: dayStart,
          status:       { in: ["CHECKED_IN", "IN_PROGRESS", "RUNNING"] },
        },
        select: { staff_id: true },
      });
      busyBookings.forEach(b => busyStaffIds.add(b.staff_id));
    }

    const queueDepths: Map<string, number> = new Map();
    if (allStaffIds.length > 0) {
      const queueCounts = await prisma.booking.groupBy({
        by:    ["staff_id"],
        where: {
          staff_id:     { in: allStaffIds },
          service_date: dayStart,
          status:       { in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "RUNNING", "PENDING_PAYMENT"] },
        },
        _count: { id: true },
      });
      queueCounts.forEach(q => queueDepths.set(q.staff_id, q._count.id));
    }

    async function getNextSlot(staffId: string, schedule: any, totalDuration: number): Promise<Date | null> {
      
      const cached = await getSlotCache(staffId, dateStr);
      if (cached && cached.length > 0) {
        const first = cached[0] as any;
        return new Date(first.service_start_time);
      }

      const [openH, openM] = ((schedule?.start_time) ?? "09:00").split(":").map(Number);
      const [closeH, closeM] = ((schedule?.end_time) ?? "18:00").split(":").map(Number);
      const openTime  = new Date(service_date); openTime.setHours(openH, openM, 0, 0);
      const closeTime = new Date(service_date); closeTime.setHours(closeH, closeM, 0, 0);

      const lastBooking = await prisma.booking.findFirst({
        where: {
          staff_id:     staffId,
          service_date: dayStart,
          status:       { in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "PENDING_PAYMENT"] },
        },
        orderBy: { service_end_time: "desc" },
        select:  { service_end_time: true },
      });

      const effectiveStart = lastBooking
        ? add(lastBooking.service_end_time, { minutes: BUFFER_MINUTES })
        : openTime;

      const serviceEnd = add(effectiveStart, { minutes: totalDuration });
      if (serviceEnd > closeTime) return null; // fully booked
      return effectiveStart;
    }

    const fullyCapable: SuggestedStaffItemDTO[] = [];
    const partialMatches: PartialMatchStaffDTO[] = [];

    for (const staff of staffList) {
      const isOnLeave   = staff.leaves.length > 0;
      const hasSchedule = staff.schedules.length > 0;
      const isBusy      = busyStaffIds.has(staff.id);

      const coveredIds = new Set(staff.services.map(sv => sv.service_offering.id));
      const allCovered = service_offering_ids.every(id => coveredIds.has(id));

      if (!allCovered) {
        const canDo: string[]   = [];
        const missing: string[] = [];
        for (const sid of service_offering_ids) {
          const name = offeringNameMap.get(sid) ?? sid;
          if (coveredIds.has(sid)) canDo.push(name);
          else missing.push(name);
        }
        partialMatches.push({
          staff_id:   staff.id,
          staff_name: staff.name,
          avatar_url: staff.avatar_url ?? null,
          can_do:     canDo,
          missing,
        });
        continue;
      }

      const totalDuration = staff.services
        .filter(sv => service_offering_ids.includes(sv.service_offering.id))
        .reduce((sum: number, sv: any) => sum + sv.duration_minutes, 0);

      const schedule    = staff.schedules[0];
      const queueDepth  = queueDepths.get(staff.id) ?? 0;
      const nextSlot    = (!isOnLeave && hasSchedule) ? await getNextSlot(staff.id, schedule, totalDuration) : null;

      const status: "FREE" | "BUSY" | "OFF" =
        isOnLeave || !hasSchedule ? "OFF" :
        isBusy ? "BUSY" : "FREE";

      fullyCapable.push({
        staff_id:               staff.id,
        staff_name:             staff.name,
        avatar_url:             staff.avatar_url ?? null,
        specialization:         staff.specialization ?? null,
        experience_years:       staff.experience_years ?? null,
        average_rating:         staff.average_rating ?? 0,
        total_reviews:          staff.total_reviews ?? 0,
        status,
        services: staff.services
          .filter(sv => service_offering_ids.includes(sv.service_offering.id))
          .map(sv => ({
            offering_id:      sv.service_offering.id,
            name:             sv.service_offering.platform_service.name,
            duration_minutes: sv.duration_minutes,
          })),
        total_duration_minutes:  totalDuration,
        estimated_service_start: nextSlot ? toIST(nextSlot) : null,
        queue_position:          queueDepth,
      });
    }

    fullyCapable.sort((a, b) => {
      const statusOrder = { FREE: 0, BUSY: 1, OFF: 2 };
      if (statusOrder[a.status] !== statusOrder[b.status])
        return statusOrder[a.status] - statusOrder[b.status];
      if (a.queue_position !== b.queue_position)
        return a.queue_position - b.queue_position;          
      return b.average_rating - a.average_rating;           
    });

    let message: string;
    let no_staff_reason: StaffSuggestionResponseDTO["no_staff_reason"];

    const totalDurationMin = offeringDetails.reduce((s, o) => {
      
      return s; 
    }, 0);

    const repDuration = fullyCapable[0]?.total_duration_minutes ?? 0;

    if (fullyCapable.length === 0 && partialMatches.length === 0) {
      message = "No staff at this salon offer the requested services.";
      no_staff_reason = "no_matching_staff";
    } else if (fullyCapable.length === 0) {
      const uncoverable = service_offering_ids.filter(sid => {
        return !staffList.some(st =>
          st.services.some(sv => sv.service_offering.id === sid)
        );
      });
      const uncoverableNames = uncoverable.map(id => offeringNameMap.get(id) ?? id);
      if (uncoverableNames.length > 0) {
        message = `No single staff member can perform all selected services. ` +
          `No staff offers: ${uncoverableNames.join(", ")}. ` +
          `Consider booking separately or removing those services.`;
      } else {
        message = `No single staff member can perform all selected services together. ` +
          `You may need to book with different staff members or on separate visits.`;
      }
      no_staff_reason = "no_matching_staff";
    } else {
      const available = fullyCapable.filter(s => s.status !== "OFF");
      if (available.length === 0) {
        message = `All ${fullyCapable.length} matching staff are off today. Try another date.`;
        no_staff_reason = "all_on_leave";
      } else {
        const nullSlots = available.filter(s => s.estimated_service_start === null);
        if (nullSlots.length === available.length) {
          message = `All matching staff are fully booked for the day. Try another date.`;
          no_staff_reason = "all_fully_booked";
        } else {
          message = `${available.length} staff member${available.length > 1 ? "s" : ""} can perform all your selected services. ` +
            (repDuration > 0 ? `Total estimated time: ${repDuration} min.` : "");
        }
      }
    }

    return {
      can_fully_serve: fullyCapable,
      partial_matches: partialMatches,
      message,
      total_duration_min: repDuration,
      no_staff_reason,
    };
  }

  static async findAvailableSlots(input: FindSlotsInput): Promise<SlotResult[]> {
    const { business_id, service_offering_ids, service_date, preferred_staff_id, mode = "select" } = input;

    const dayStart = startOfDay(service_date);
    const dayEnd   = endOfDay(service_date);
    const dow      = dowIST(service_date);
    const dateStr  = service_date.toISOString().slice(0, 10);

    const staffWhere: any = {
      business_id,
      is_active: true,
      ...(mode === "select" && preferred_staff_id && { id: preferred_staff_id }),
      services: {
        some: {
          service_offering: { id: { in: service_offering_ids }, is_active: true },
          is_available: true,
        },
      },
    };

    const staffList = await prisma.staff.findMany({
      where:   staffWhere,
      include: {
        schedules: { where: { day_of_week: dow as any, is_available: true } },
        leaves: {
          where: {
            status:     "APPROVED",
            start_date: { lte: dayEnd },
            end_date:   { gte: dayStart },
          },
        },
        services: {
          where: {
            is_available:     true,
            service_offering: { id: { in: service_offering_ids }, is_active: true },
          },
          include: { service_offering: { select: { id: true } } },
        },
      },
    });

    const holiday = await prisma.holiday.findFirst({
      where: {
        business_id,
        start_date:           { lte: dayEnd },
        end_date:             { gte: dayStart },
        applies_to_all_staff: true,
      },
    });
    if (holiday) return [];

    const allStaffIds = staffList.map(s => s.id);
    const queueDepths: Map<string, number> = new Map();
    if (mode === "random" && allStaffIds.length > 0) {
      const counts = await prisma.booking.groupBy({
        by:    ["staff_id"],
        where: {
          staff_id:     { in: allStaffIds },
          service_date: dayStart,
          status:       { in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "RUNNING", "PENDING_PAYMENT"] },
        },
        _count: { id: true },
      });
      counts.forEach(c => queueDepths.set(c.staff_id, c._count.id));
    }

    const slots: SlotResult[] = [];

    for (const staff of staffList) {
      if (staff.schedules.length === 0) continue;
      if (staff.leaves.length > 0) continue;

      const schedule = staff.schedules[0];

      const coveredIds = new Set(staff.services.map(sv => sv.service_offering.id));
      const allCovered = service_offering_ids.every(id => coveredIds.has(id));
      if (!allCovered) continue;

      const totalDuration = staff.services
        .filter(sv => service_offering_ids.includes(sv.service_offering.id))
        .reduce((sum: number, sv: any) => sum + sv.duration_minutes, 0);
      if (totalDuration === 0) continue;

      const [oh, om] = (schedule.start_time ?? "09:00").split(":").map(Number);
      const [ch, cm] = (schedule.end_time   ?? "18:00").split(":").map(Number);

      const openTime  = new Date(service_date);
      const closeTime = new Date(service_date);
      openTime.setHours(oh, om, 0, 0);
      closeTime.setHours(ch, cm, 0, 0);

      let effectiveStart: Date;
      const cached = await getSlotCache(staff.id, dateStr);

      if (cached && cached.length > 0) {
        const first = cached[0] as any;
        effectiveStart = new Date(first.service_start_time);
      } else {
        const lastBooking = await prisma.booking.findFirst({
          where: {
            staff_id:     staff.id,
            service_date: dayStart,
            status:       { in: ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "PENDING_PAYMENT"] },
          },
          orderBy: { service_end_time: "desc" },
          select:  { service_end_time: true },
        });
        effectiveStart = lastBooking
          ? add(lastBooking.service_end_time, { minutes: BUFFER_MINUTES })
          : openTime;
      }

      const serviceEnd = add(effectiveStart, { minutes: totalDuration });
      if (serviceEnd > closeTime) continue;

      const queueEntry = await prisma.dailyQueue.findUnique({
        where: { staff_id_service_date: { staff_id: staff.id, service_date: dayStart } },
        select: { last_queue_number: true },
      });
      const queueNumber = (queueEntry?.last_queue_number ?? 0) + 1;

      const arrivalWindowStart = (() => {
        const t = add(effectiveStart, { minutes: -15 });
        return t < openTime ? openTime : t;
      })();

      slots.push({
        staff_id:             staff.id,
        staff_name:           staff.name,
        avatar_url:           staff.avatar_url ?? null,
        service_start_time:   effectiveStart,
        arrival_window_start: arrivalWindowStart,
        arrival_window_end:   effectiveStart,
        service_end_time:     serviceEnd,
        estimated_duration:   totalDuration,
        total_duration:       totalDuration,
        queue_number:         queueNumber,
      });
    }

    if (mode === "random") {
      
      slots.sort((a, b) => {
        const da = queueDepths.get(a.staff_id) ?? 0;
        const db = queueDepths.get(b.staff_id) ?? 0;
        if (da !== db) return da - db;                                     
        const timeDiff = a.service_start_time.getTime() - b.service_start_time.getTime();
        if (timeDiff !== 0) return timeDiff;                               
        const ra = staffList.find(s => s.id === a.staff_id)?.average_rating ?? 0;
        const rb = staffList.find(s => s.id === b.staff_id)?.average_rating ?? 0;
        return rb - ra;
      });
      
      const best = slots.slice(0, 1);
      
      await BookingRepository._populateSlotCache(staffList, slots, dateStr);
      return best;
    }

    slots.sort((a, b) => {
      if (preferred_staff_id) {
        if (a.staff_id === preferred_staff_id) return -1;
        if (b.staff_id === preferred_staff_id) return  1;
      }
      return a.service_start_time.getTime() - b.service_start_time.getTime();
    });

    await BookingRepository._populateSlotCache(staffList, slots, dateStr);

    return slots;
  }

  private static async _populateSlotCache(staffList: any[], slots: SlotResult[], dateStr: string) {
    const staffIds = [...new Set(staffList.map(s => s.id))];
    for (const sid of staffIds) {
      const staffSlots = slots.filter(s => s.staff_id === sid);
      const serialised = staffSlots.map(s => ({
        ...s,
        service_start_time:   s.service_start_time.toISOString(),
        arrival_window_start: s.arrival_window_start.toISOString(),
        arrival_window_end:   s.arrival_window_end.toISOString(),
        service_end_time:     s.service_end_time.toISOString(),
      }));
      setSlotCache(sid, dateStr, serialised).catch(() => {});
    }
  }

  static async createReservation(data: ReservationData): Promise<string> {
    const token = uuid();
    await redisClient.setex(`reservation:${token}`, RESERVATION_TTL, JSON.stringify(data));
    return token;
  }

  static async getReservation(token: string): Promise<ReservationData | null> {
    const raw = await redisClient.get(`reservation:${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReservationData;
    parsed.slots = parsed.slots.map(s => ({
      ...s,
      service_start_time:   new Date(s.service_start_time),
      arrival_window_start: new Date(s.arrival_window_start),
      arrival_window_end:   new Date(s.arrival_window_end),
      service_end_time:     new Date(s.service_end_time),
    }));
    return parsed;
  }

  static async deleteReservation(token: string): Promise<void> {
    await redisClient.del(`reservation:${token}`);
  }

  static async findBookingFull(bookingId: string) {
    return prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        customer: {
          select: {
            id:       true,
            name:     true,
            username: true,
            user: { select: { id: true, email: true } },
          },
        },
        staff: {
          select: {
            id:         true,
            name:       true,
            avatar_url: true,
            phone:      true,
            user:       { select: { id: true } },
          },
        },
        business: {
          select: {
            id:             true,
            business_name:  true,
            address_line1:  true,
            city:           true,
            state:          true,
            logo_url:       true,
            business_phone: true,
            map_link:       true,
            auth_user_id:   true,
            owner: {
              select: { id: true, user: { select: { id: true } } },
            },
          },
        },
        qr_code:     { select: { qr_image_url: true, expires_at: true } },
        transaction: {
          select: {
            id: true, status: true, razorpay_payment_id: true,
            paid_at: true, refund_status: true, refund_amount: true,
          },
        },
        escrow: { select: { id: true, status: true, amount: true } },
      },
    });
  }

  static async findByCustomerTab(
    customer_id: string,
    tab:         string,
    page:        number,
    limit:       number,
  ) {
    const TAB_STATUSES: Record<string, string[]> = {
      today:     ["CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "PENDING_PAYMENT"],
      upcoming:  ["PENDING_PAYMENT", "CONFIRMED"],
      completed: ["COMPLETED"],
      cancelled: ["CANCELLED", "CANCELLED_TIMEOUT"],
      no_show:   ["CANCELLED_NO_SHOW"],
    };

    const statuses   = TAB_STATUSES[tab] ?? TAB_STATUSES["upcoming"];
    const today      = startOfDay(new Date());
    const extraWhere: any = tab === "today" ? { service_date: today } : {};

    const where = { customer_id, status: { in: statuses }, ...extraWhere };

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          business:    { select: { business_name: true, logo_url: true, city: true } },
          staff:       { select: { name: true, avatar_url: true } },
          transaction: { select: { refund_status: true, refund_amount: true } },
        },
        orderBy: tab === "today" ? { service_start_time: "asc" } : { created_at: "desc" },
        skip:    (page - 1) * limit,
        take:    limit,
      }),
      prisma.booking.count({ where }),
    ]);

    return { bookings, total };
  }

  static generateBookingNumber(): string {
    const ts   = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    return `BK-${ts}-${rand}`;
  }
}
