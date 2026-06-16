import { prisma } from "../../../config/prisma";
import { startOfDay } from "date-fns";

const TODAY_BOOKING_INCLUDE = {
  customer: { select: { id: true, name: true, avatar_url: true, phone: true } },
  staff:    { select: { id: true, name: true, avatar_url: true } },
} as const;

export class BusinessTodayRepository {

  static async getLiveQueue(businessId: string) {
    const today = startOfDay(new Date());

    return prisma.booking.findMany({
      where: {
        business_id:  businessId,
        service_date: today,
        status:       { in: ["RUNNING", "CONFIRMED"] },
      },
      include: TODAY_BOOKING_INCLUDE,
      orderBy: [
        { queue_number: "asc" },
      ],
    });
  }

  static async getStaffStatus(businessId: string) {
    const today = startOfDay(new Date());

    const [allStaff, approvedLeaves, runningHoliday] = await Promise.all([
      prisma.staff.findMany({
        where:  { business_id: businessId, is_active: true },
        select: {
          id:         true,
          name:       true,
          avatar_url: true,
        },
        orderBy: { name: "asc" },
      }),
      prisma.staffLeave.findMany({
        where: {
          staff:      { business_id: businessId },
          status:     "APPROVED",
          start_date: { lte: today },
          end_date:   { gte: today },
        },
        select: { staff_id: true },
      }),
      prisma.holiday.findFirst({
        where: {
          business_id: businessId,
          start_date:  { lte: today },
          end_date:    { gte: today },
        },
        select: { applies_to_all_staff: true },
      }),
    ]);

    return { allStaff, approvedLeaves, runningHoliday };
  }

  static async findBooking(bookingId: string, businessId: string) {
    return prisma.booking.findFirst({
      where:   { id: bookingId, business_id: businessId },
      include: TODAY_BOOKING_INCLUDE,
    });
  }

  static async getDaySummary(businessId: string) {
    const today = startOfDay(new Date());

    const [total, completed, running, upcoming] = await Promise.all([
      prisma.booking.count({
        where: { business_id: businessId, service_date: today, status: { not: "PENDING_PAYMENT" } },
      }),
      prisma.booking.count({
        where: { business_id: businessId, service_date: today, status: "COMPLETED" },
      }),
      prisma.booking.count({
        where: {
          business_id:  businessId,
          service_date: today,
          status:       "RUNNING",
        },
      }),
      prisma.booking.count({
        where: { business_id: businessId, service_date: today, status: "CONFIRMED" },
      }),
    ]);

    return { total, completed, running, upcoming };
  }
}
