import { prisma }                                from "../../../config/prisma";
import { redisClient }                           from "../../../config/redis";
import { startOfDay, endOfDay, add, addMinutes } from "date-fns";
import { toZonedTime, formatInTimeZone }         from "date-fns-tz";
import { v4 as uuid }                            from "uuid";
import { setSlotCache }                          from "../../../utils/cache/slotCache";
import { Prisma } from "../../../../generated/prisma/client.js";
import {
  ceilToMinute,
  deriveArrivalWindowEnd,
  deriveArrivalWindowStart,
  deriveScanWindowEnd as deriveMinuteScanWindowEnd,
  deriveServiceEnd as deriveMinuteServiceEnd,
} from "../../../utils/helpers/timeWindows";
import type {
  StaffSuggestionResponseDTO,
  SuggestedStaffItemDTO,
  PartialMatchStaffDTO,
} from "./booking.types";

const IST             = "Asia/Kolkata";
const RESERVATION_TTL = 600;   // 10 min in seconds
const BUFFER_MINUTES  = 5;     // mandatory gap between consecutive bookings
export interface SlotResult {
  staff_id:           string;
  staff_name:         string;
  avatar_url:         string | null;
  service_start_time: Date;
  estimated_duration: number;
  total_duration:     number;
  queue_number:       number;
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

function istDateBounds(dateStr: string): { leaveStart: Date; leaveEnd: Date } {
  return {
    leaveStart: new Date(dateStr + "T00:00:00.000Z"),
    leaveEnd:   new Date(dateStr + "T23:59:59.999Z"),
  };
}

export function deriveArrivalStart(serviceStart: Date): Date {
  return deriveArrivalWindowStart(serviceStart);
}
export function deriveArrivalEnd(serviceStart: Date): Date {
  return deriveArrivalWindowEnd(serviceStart);
}

export function deriveScanWindowStart(serviceStart: Date): Date {
  return deriveArrivalWindowStart(serviceStart);
}

export function deriveServiceEnd(serviceStart: Date, durationMinutes: number): Date {
  return deriveMinuteServiceEnd(serviceStart, durationMinutes);
}
export function deriveScanWindowEnd(serviceStart: Date): Date {
  return deriveMinuteScanWindowEnd(serviceStart);
}

async function findFirstAvailableGap(
  staffId:        string,
  dayStart:       Date,          
  dateStr:        string,        
  openTime:       Date,
  closeTime:      Date,
  durationMin:    number,
  isToday:        boolean,
  travelBuffer:   number,        
  tx?:            Prisma.TransactionClient,
): Promise<Date | null> {

  const db = tx ?? prisma;

  const bookings = await (db as any).booking.findMany({
    where: {
      staff_id:     staffId,
      service_date: dayStart,
      status:       { in: ["CONFIRMED", "RUNNING"] },
    },
    orderBy: { service_start_time: "asc" },
    select:  { service_start_time: true, estimated_duration: true },
  }) as { service_start_time: Date; estimated_duration: number }[];

  const earliestPossible: Date = isToday
    ? ceilToMinute(add(new Date(), { minutes: travelBuffer }))
    : openTime;

  const clamp = (t: Date): Date => ceilToMinute(t < earliestPossible ? earliestPossible : t);

  const firstStart = bookings.length > 0
    ? bookings[0].service_start_time
    : null;

  const candidate0 = clamp(openTime);
  const end0       = addMinutes(candidate0, durationMin);

  if (firstStart === null) {
    
    if (end0 <= closeTime) return candidate0;
    return null; 
  }

  if (addMinutes(end0, BUFFER_MINUTES) <= firstStart) {
    return candidate0;
  }

  for (let i = 0; i < bookings.length - 1; i++) {
    const prevEnd  = addMinutes(bookings[i].service_start_time, bookings[i].estimated_duration);
    const nextStart = bookings[i + 1].service_start_time;

    const candidateRaw = addMinutes(prevEnd, BUFFER_MINUTES);
    const candidate    = clamp(candidateRaw);
    const end          = addMinutes(candidate, durationMin);

    if (addMinutes(end, BUFFER_MINUTES) <= nextStart) {
      return candidate;
    }
  }

  const last         = bookings[bookings.length - 1];
  const lastEnd      = addMinutes(last.service_start_time, last.estimated_duration);
  const candidateRaw = addMinutes(lastEnd, BUFFER_MINUTES);
  const candidate    = clamp(candidateRaw);
  const end          = addMinutes(candidate, durationMin);

  if (end <= closeTime) return candidate;

  return null; // no gap fits
}
export class BookingRepository {

  static async suggestStaff(
    business_id:          string,
    service_offering_ids: string[],
    service_date:         Date,
  ): Promise<StaffSuggestionResponseDTO> {

    const dateStr  = formatInTimeZone(service_date, IST, "yyyy-MM-dd");
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dow      = dowIST(service_date);
    const { leaveStart, leaveEnd } = istDateBounds(dateStr);
    const todayStr = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
    const isToday  = dateStr === todayStr;

    const holiday = await prisma.holiday.findFirst({
      where: {
        business_id,
        start_date:           { lte: leaveEnd },
        end_date:             { gte: leaveStart },
        applies_to_all_staff: true,
      },
    });
    if (holiday) {
      return {
        can_fully_serve: [], partial_matches: [],
        message: "The salon is closed on this date due to a holiday.",
        total_duration_min: 0, no_staff_reason: "holiday",
      };
    }

    const offeringDetails = await prisma.businessServiceOffering.findMany({
      where:   { id: { in: service_offering_ids }, business_id, is_active: true },
      include: { platform_service: { select: { name: true } } },
    });
    const offeringNameMap = new Map(offeringDetails.map(o => [o.id, o.platform_service.name]));

    const staffList = await prisma.staff.findMany({
      where: {
        business_id, is_active: true,
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
            start_date: { lte: leaveEnd },
            end_date:   { gte: leaveStart },
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

    const busyStaffIds = new Set<string>();
    if (isToday && allStaffIds.length > 0) {
      const busy = await prisma.booking.findMany({
        where: {
          staff_id:     { in: allStaffIds },
          service_date: dayStart,
          status:       { in: ["RUNNING"] },
        },
        select: { staff_id: true },
      });
      busy.forEach(b => busyStaffIds.add(b.staff_id));
    }

    const queueDepths = new Map<string, number>();
    if (allStaffIds.length > 0) {
      const counts = await prisma.booking.groupBy({
        by:    ["staff_id"],
        where: {
          staff_id:     { in: allStaffIds },
          service_date: dayStart,
          status:       { in: ["CONFIRMED", "RUNNING"] },
        },
        _count: { id: true },
      });
      counts.forEach(q => queueDepths.set(q.staff_id, q._count.id));
    }

    const businessSchedule = await prisma.businessSchedule.findFirst({
      where:  { business_id, day_of_week: dow as any, is_open: true },
      select: { open_time: true, close_time: true },
    });

    const TRAVEL_BUFFER = 30;
    const fullyCapable: SuggestedStaffItemDTO[]  = [];
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
          if (coveredIds.has(sid)) canDo.push(name); else missing.push(name);
        }
        partialMatches.push({
          staff_id: staff.id, staff_name: staff.name,
          avatar_url: staff.avatar_url ?? null, can_do: canDo, missing,
        });
        continue;
      }

      const totalDuration = staff.services
        .filter(sv => service_offering_ids.includes(sv.service_offering.id))
        .reduce((sum: number, sv: any) => sum + sv.duration_minutes, 0);

      const schedule   = staff.schedules[0];
      const queueDepth = queueDepths.get(staff.id) ?? 0;

      let nextSlot: Date | null = null;
      if (!isOnLeave && hasSchedule) {
        const rawOpen  = schedule.start_time  ?? businessSchedule?.open_time  ?? "09:00";
        const rawClose = schedule.end_time    ?? businessSchedule?.close_time ?? "18:00";
        const openTime  = new Date(`${dateStr}T${rawOpen}:00+05:30`);
        const closeTime = new Date(`${dateStr}T${rawClose}:00+05:30`);
        nextSlot = await findFirstAvailableGap(
          staff.id, new Date(dateStr + "T00:00:00.000Z"),
          dateStr, openTime, closeTime, totalDuration, isToday, TRAVEL_BUFFER,
        );
      }

      const status: "FREE" | "BUSY" | "OFF" =
        isOnLeave || !hasSchedule ? "OFF" : isBusy ? "BUSY" : "FREE";

      fullyCapable.push({
        staff_id:               staff.id,
        staff_name:             staff.name,
        avatar_url:             staff.avatar_url ?? null,
        specialization:         staff.specialization ?? null,
        experience_years:       staff.experience_years ?? null,
        average_rating:         staff.average_rating ?? 0,
        total_reviews:          staff.total_reviews  ?? 0,
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
      const order = { FREE: 0, BUSY: 1, OFF: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      if (a.queue_position !== b.queue_position) return a.queue_position - b.queue_position;
      return b.average_rating - a.average_rating;
    });

    // ── Build response message ───────────────────────────────────────────────
    const repDuration = fullyCapable[0]?.total_duration_minutes ?? 0;
    let message: string;
    let no_staff_reason: StaffSuggestionResponseDTO["no_staff_reason"];

    if (fullyCapable.length === 0 && partialMatches.length === 0) {
      message         = "No staff at this salon offer the requested services.";
      no_staff_reason = "no_matching_staff";
    } else if (fullyCapable.length === 0) {
      const uncoverable = service_offering_ids.filter(sid =>
        !staffList.some(st => st.services.some(sv => sv.service_offering.id === sid)),
      );
      const names = uncoverable.map(id => offeringNameMap.get(id) ?? id);
      message         = names.length > 0
        ? `No single staff can perform all services. Missing: ${names.join(", ")}.`
        : "No single staff member can perform all selected services together.";
      no_staff_reason = "no_matching_staff";
    } else {
      const available = fullyCapable.filter(s => s.status !== "OFF");
      if (available.length === 0) {
        const anyOnLeave = staffList.some(s =>
          s.leaves.length > 0 &&
          service_offering_ids.every((id: string) =>
            s.services.some((sv: any) => sv.service_offering.id === id),
          ),
        );
        message         = anyOnLeave
          ? "All matching staff are on approved leave for this date."
          : "No matching staff are available on this day.";
        no_staff_reason = anyOnLeave ? "all_on_leave" : "not_scheduled";
      } else {
        const nullSlots = available.filter(s => s.estimated_service_start === null);
        if (nullSlots.length === available.length) {
          const overflow = available.some(s => (queueDepths.get(s.staff_id) ?? 0) > 0);
          message         = overflow
            ? "Queue extended beyond working hours due to delays."
            : "All matching staff are fully booked for the day.";
          no_staff_reason = overflow ? "queue_overflow" : "all_fully_booked";
        } else {
          message =
            `${available.length} staff member${available.length > 1 ? "s" : ""} can perform all selected services.` +
            (repDuration > 0 ? ` Total estimated time: ${repDuration} min.` : "");
        }
      }
    }

    return { can_fully_serve: fullyCapable, partial_matches: partialMatches, message, total_duration_min: repDuration, no_staff_reason };
  }

  
  static async findAvailableSlots(input: FindSlotsInput): Promise<SlotResult[]> {
    const {
      business_id, service_offering_ids, service_date,
      preferred_staff_id, mode = "select",
    } = input;

    const dateStr  = formatInTimeZone(service_date, IST, "yyyy-MM-dd");
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dow      = dowIST(service_date);
    const { leaveStart, leaveEnd } = istDateBounds(dateStr);
    const todayStr = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
    const isToday  = dateStr === todayStr;
    const TRAVEL   = 30;

    // Holiday guard
    const holiday = await prisma.holiday.findFirst({
      where: {
        business_id,
        start_date:           { lte: leaveEnd },
        end_date:             { gte: leaveStart },
        applies_to_all_staff: true,
      },
    });
    if (holiday) return [];

    const staffWhere: any = {
      business_id, is_active: true,
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
            start_date: { lte: leaveEnd },
            end_date:   { gte: leaveStart },
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

    // Queue depths for random-mode sorting
    const queueDepths = new Map<string, number>();
    if (mode === "random" && staffList.length > 0) {
      const counts = await prisma.booking.groupBy({
        by:    ["staff_id"],
        where: {
          staff_id:     { in: staffList.map(s => s.id) },
          service_date: dayStart,
          status:       { in: ["CONFIRMED", "RUNNING"] },
        },
        _count: { id: true },
      });
      counts.forEach(c => queueDepths.set(c.staff_id, c._count.id));
    }

    const businessSchedule = await prisma.businessSchedule.findFirst({
      where:  { business_id, day_of_week: dow as any, is_open: true },
      select: { open_time: true, close_time: true },
    });

    const slots: SlotResult[] = [];

    for (const staff of staffList) {
      if (staff.schedules.length === 0) continue;
      if (staff.leaves.length    > 0)  continue;

      const schedule   = staff.schedules[0];
      const coveredIds = new Set(staff.services.map(sv => sv.service_offering.id));
      if (!service_offering_ids.every(id => coveredIds.has(id))) continue;

      const totalDuration = staff.services
        .filter(sv => service_offering_ids.includes(sv.service_offering.id))
        .reduce((sum: number, sv: any) => sum + sv.duration_minutes, 0);
      if (totalDuration === 0) continue;

      const rawOpen  = schedule.start_time  ?? businessSchedule?.open_time  ?? "09:00";
      const rawClose = schedule.end_time    ?? businessSchedule?.close_time ?? "18:00";
      const openTime  = new Date(`${dateStr}T${rawOpen}:00+05:30`);
      const closeTime = new Date(`${dateStr}T${rawClose}:00+05:30`);

      // ── Gap-fill slot finder ───────────────────────────────────────────────
      const slotStart = await findFirstAvailableGap(
        staff.id, dayStart, dateStr,
        openTime, closeTime, totalDuration, isToday, TRAVEL,
      );
      if (!slotStart) continue;

      // Queue number = total bookings today + 1 (includes cancelled for ordering)
      const totalCount = await prisma.booking.count({
        where: {
          staff_id:     staff.id,
          service_date: dayStart,
          status:       { in: ["CONFIRMED", "RUNNING"] },
        },
      });
      const queueNumber = totalCount + 1;

      slots.push({
        staff_id:           staff.id,
        staff_name:         staff.name,
        avatar_url:         staff.avatar_url ?? null,
        service_start_time: slotStart,
        estimated_duration: totalDuration,
        total_duration:     totalDuration,
        queue_number:       queueNumber,
      });
    }

    // Sort and cap for random mode
    if (mode === "random") {
      slots.sort((a, b) => {
        const da = queueDepths.get(a.staff_id) ?? 0;
        const db = queueDepths.get(b.staff_id) ?? 0;
        if (da !== db) return da - db;
        const dt = a.service_start_time.getTime() - b.service_start_time.getTime();
        if (dt !== 0) return dt;
        const ra = staffList.find(s => s.id === a.staff_id)?.average_rating ?? 0;
        const rb = staffList.find(s => s.id === b.staff_id)?.average_rating ?? 0;
        return rb - ra;
      });
      await BookingRepository._populateSlotCache(staffList, slots, dateStr);
      return slots.slice(0, 1);
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


  static async computeActualSlotInTransaction(
    tx:            Prisma.TransactionClient,
    staffId:       string,
    dayStart:      Date,
    dateStr:       string,
    openTime:      Date,
    closeTime:     Date,
    durationMin:   number,
    isToday:       boolean,
  ): Promise<Date | null> {
    const TRAVEL = 30;
    return findFirstAvailableGap(
      staffId, dayStart, dateStr,
      openTime, closeTime, durationMin, isToday, TRAVEL, tx,
    );
  }

  // ── Slot cache helpers ──────────────────────────────────────────────────────
  private static async _populateSlotCache(
    staffList: any[], slots: SlotResult[], dateStr: string,
  ) {
    const staffIds = [...new Set(staffList.map(s => s.id))];
    for (const sid of staffIds) {
      const serialised = slots
        .filter(s => s.staff_id === sid)
        .map(s => ({ ...s, service_start_time: s.service_start_time.toISOString() }));
      setSlotCache(sid, dateStr, serialised).catch(() => {});
    }
  }

  // ── Reservation (Redis TTL token) ───────────────────────────────────────────
  static async createReservation(data: ReservationData): Promise<string> {
    const token = uuid();
    await redisClient.setex(
      `reservation:${token}`,
      RESERVATION_TTL,
      JSON.stringify(data),
    );
    return token;
  }

  static async getReservation(token: string): Promise<ReservationData | null> {
    const raw = await redisClient.get(`reservation:${token}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReservationData;
    parsed.slots = parsed.slots.map(s => ({
      ...s,
      service_start_time: new Date(s.service_start_time),
    }));
    return parsed;
  }

  static async deleteReservation(token: string): Promise<void> {
    await redisClient.del(`reservation:${token}`);
  }

  // ── Diagnostics (when no slot found for a specific staff) ──────────────────
  static async diagnoseNoSlotsForStaff(input: {
    business_id:          string;
    staff_id:             string;
    service_offering_ids: string[];
    service_date:         Date;
  }): Promise<string> {
    const { business_id, staff_id, service_offering_ids, service_date } = input;
    const dateStr  = formatInTimeZone(service_date, IST, "yyyy-MM-dd");
    const dayStart = new Date(dateStr + "T00:00:00.000Z");
    const dow      = dowIST(service_date);
    const { leaveStart, leaveEnd } = istDateBounds(dateStr);
    const todayStr = formatInTimeZone(new Date(), IST, "yyyy-MM-dd");
    const isToday  = dateStr === todayStr;

    const staff = await prisma.staff.findFirst({
      where:  { id: staff_id, business_id, is_active: true },
      select: { id: true, name: true },
    });
    if (!staff) return "This staff member is no longer available at this salon.";

    const leave = await prisma.staffLeave.findFirst({
      where: {
        staff_id, status: "APPROVED",
        start_date: { lte: leaveEnd }, end_date: { gte: leaveStart },
      },
    });
    if (leave) return `${staff.name} is on leave on this date. Please choose a different date or another staff member.`;

    const schedule = await prisma.staffSchedule.findFirst({
      where:  { staff_id, day_of_week: dow as any, is_available: true },
      select: { start_time: true, end_time: true },
    });
    if (!schedule) return `${staff.name} does not work on ${dow.charAt(0) + dow.slice(1).toLowerCase()}s. Please choose a different date.`;

    const staffServices = await prisma.staffService.findMany({
      where: {
        staff_id, is_available: true,
        service_offering: { id: { in: service_offering_ids }, is_active: true },
      },
      select: { service_offering_id: true, duration_minutes: true },
    });
    const coveredIds = new Set(staffServices.map(s => s.service_offering_id));
    if (!service_offering_ids.every(id => coveredIds.has(id))) {
      return `${staff.name} does not offer all selected services. Please choose a different staff member.`;
    }

    const bizSchedule = await prisma.businessSchedule.findFirst({
      where:  { business_id, day_of_week: dow as any, is_open: true },
      select: { open_time: true, close_time: true },
    });
    const rawOpen  = schedule.start_time  ?? bizSchedule?.open_time  ?? "09:00";
    const rawClose = schedule.end_time    ?? bizSchedule?.close_time ?? "18:00";
    const openTime  = new Date(`${dateStr}T${rawOpen}:00+05:30`);
    const closeTime = new Date(`${dateStr}T${rawClose}:00+05:30`);
    const totalDuration = staffServices.reduce((sum, s) => sum + s.duration_minutes, 0);

    const slot = await findFirstAvailableGap(
      staff_id, dayStart, dateStr,
      openTime, closeTime, totalDuration, isToday, 30,
    );

    if (slot === null) {
      // Distinguish between "fully booked" and "no time left"
      const queueCount = await prisma.booking.count({
        where: {
          staff_id, service_date: dayStart,
          status: { in: ["CONFIRMED", "RUNNING"] },
        },
      });
      if (queueCount > 0) {
        return `${staff.name} is fully booked for this date — no gap fits your service (${totalDuration} min). Please choose a different date.`;
      }
      return `${staff.name} does not have enough time today for your service (${totalDuration} min). Please choose a different date.`;
    }

    return "No available slots for the selected staff, date, and services. Please try a different option.";
  }

  // ── findBookingFull ─────────────────────────────────────────────────────────
  static async findBookingFull(bookingId: string) {
    return prisma.booking.findUnique({
      where:   { id: bookingId },
      include: {
        customer: {
          select: {
            id: true, name: true, username: true,
            user: { select: { id: true, email: true } },
          },
        },
        staff: {
          select: {
            id: true, name: true, avatar_url: true, phone: true,
            user: { select: { id: true } },
          },
        },
        business: {
          select: {
            id: true, business_name: true, address_line1: true,
            city: true, state: true, logo_url: true,
            business_phone: true, map_link: true,
            owner: { select: { id: true, user: { select: { id: true } } } },
          },
        },
        qr_code: { select: { qr_image_url: true, expires_at: true } },
        payment: {
          select: {
            id: true, status: true, razorpay_payment_id: true,
            paid_at: true, refund_status: true, refund_amount: true,
          },
        },
        review: {
          select: { id: true, rating: true, comment: true },
        },
      },
    });
  }

  // ── findByCustomerTab ───────────────────────────────────────────────────────
  static async findByCustomerTab(customer_id: string, tab: string, page: number, limit: number) {
    // IST-correct today boundaries
    const nowIST = new Date(new Date().toLocaleString("en-US", { timeZone: IST }));
    const todayStart = new Date(nowIST); todayStart.setHours(0, 0, 0, 0);
    const todayEnd   = new Date(nowIST); todayEnd.setHours(23, 59, 59, 999);
 
    const base: any = {
      customer_id,
      status:     { notIn: ["PENDING_PAYMENT", "EXPIRED"] },
      is_visible: { not: false },
    };
 
    let where: any;
    let orderBy: any;
 
    switch (tab) {
      case "today":
        where   = { ...base, service_date: { gte: todayStart, lte: todayEnd } };
        orderBy = { service_start_time: "asc" };
        break;
 
      case "awaiting_checkin":
        where   = { ...base, status: "RUNNING", service_started_at: null };
        orderBy = [{ service_date: "asc" }, { service_start_time: "asc" }];
        break;
 
      case "upcoming":
        where   = { ...base, status: "CONFIRMED", service_date: { gte: todayStart } };
        orderBy = [{ service_date: "asc" }, { service_start_time: "asc" }];
        break;
 
      case "completed":
        where   = { ...base, status: "COMPLETED" };
        orderBy = [{ service_date: "desc" }, { service_start_time: "desc" }];
        break;
 
      case "no_show":
        where   = { ...base, status: "NO_SHOW" };
        orderBy = { service_date: "desc" };
        break;
 
      case "refund":
        where   = { ...base, status: { in: ["REFUND_INITIATED", "REFUNDED"] } };
        orderBy = { created_at: "desc" };
        break;
 
      default:
        where   = { ...base, service_date: { gte: todayStart }, status: "CONFIRMED" };
        orderBy = [{ service_date: "asc" }, { service_start_time: "asc" }];
    }
 
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          business: {
            select: { business_name: true, logo_url: true, city: true, map_link: true },
          },
          staff: {
            select: { name: true, avatar_url: true },
          },
          payment: {
            select: { status: true, amount: true, refund_status: true, refund_amount: true, paid_at: true },
          },
          
          review: {
            select: { id: true },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
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
