import { prisma } from "../../../config/prisma";
import { add } from "date-fns";
import { hashToken } from "../../../utils/helpers/crypto";
import { generateToken } from "../../../utils/helpers/crypto";

const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"] as const;

export class BusinessStaffRepository {

  static async findStaffInBusiness(staffId: string, businessId: string) {
    return prisma.staff.findFirst({
      where: { id: staffId, business_id: businessId },
      include: {
        user:      { select: { id: true, email: true, is_active: true } },
        services:  { include: { service_offering: { include: { platform_service: true } } } },
        schedules: true,
        leaves:    { where: { status: "PENDING" }, orderBy: { created_at: "desc" } },
      },
    });
  }

  static async findAllInBusiness(businessId: string) {
    return prisma.staff.findMany({
      where:   { business_id: businessId },
      include: {
        user:     { select: { email: true } },
        services: { include: { service_offering: { include: { platform_service: true } } } },
        schedules: true,
      },
      orderBy: { name: "asc" },
    });
  }

  static async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  static async createWithTransaction(data: {
    businessId:       string;
    ownerId:          string;
    name:             string;
    email:            string;
    phone:            string;
    specialization?:  string;
    experience_years?: number;
    bio?:             string;
    services: Array<{ service_offering_id: string; duration_minutes: number }>;
    schedule?: Array<{ day_of_week: string; is_available: boolean; start_time?: string; end_time?: string }>;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email:    data.email,
          role:     "STAFF",
          is_active: true,
          version:  1,
        },
      });

      const staff = await tx.staff.create({
        data: {
          user_id:         user.id,
          business_id:     data.businessId,
          name:            data.name,
          email:           data.email,
          phone:           data.phone,
          specialization:  data.specialization,
          experience_years: data.experience_years,
          bio:             data.bio,
          is_active:       true,
        },
      });

      await tx.staffService.createMany({
        data: data.services.map((s) => ({
          staff_id:           staff.id,
          service_offering_id: s.service_offering_id,
          duration_minutes:   s.duration_minutes,
          is_available:       true,
        })),
      });

      const scheduleData = data.schedule
        ? data.schedule.map((s) => ({
            staff_id:     staff.id,
            day_of_week:  s.day_of_week as any,
            is_available: s.is_available,
            start_time:   s.start_time ?? null,
            end_time:     s.end_time   ?? null,
          }))
        : DAYS.map((day) => ({
            staff_id:     staff.id,
            day_of_week:  day,
            is_available: true,
            start_time:   null,
            end_time:     null,
          }));

      await tx.staffSchedule.createMany({ data: scheduleData });

      const rawToken    = generateToken();
      const hashedToken = hashToken(rawToken);

      await tx.emailVerificationToken.create({
        data: {
          user_id:    user.id,
          token:      hashedToken,
          expires_at: add(new Date(), { hours: 48 }),
        },
      });

      await tx.owner.update({
        where: { id: data.ownerId },
        data:  { total_staff: { increment: 1 } },
      });

      return { staff, user, rawToken };
    });
  }

  static async updateStaff(staffId: string, data: {
    name?:            string;
    phone?:           string;
    specialization?:  string;
    experience_years?: number;
    bio?:             string;
    is_active?:       boolean;
  }) {
    return prisma.staff.update({ where: { id: staffId }, data });
  }

  static async updateServices(
    staffId:   string,
    services:  Array<{ service_offering_id: string; duration_minutes: number; is_available?: boolean }>
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.staffService.deleteMany({ where: { staff_id: staffId } });
      await tx.staffService.createMany({
        data: services.map((s) => ({
          staff_id:            staffId,
          service_offering_id: s.service_offering_id,
          duration_minutes:    s.duration_minutes,
          is_available:        s.is_available ?? true,
        })),
      });
    });
  }

  static async updateSchedule(staffId: string, schedule: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time?:  string;
    end_time?:    string;
  }>) {
    return prisma.$transaction(
      schedule.map((s) =>
        prisma.staffSchedule.upsert({
          where:  { staff_id_day_of_week: { staff_id: staffId, day_of_week: s.day_of_week as any } },
          update: { is_available: s.is_available, start_time: s.start_time ?? null, end_time: s.end_time ?? null },
          create: { staff_id: staffId, day_of_week: s.day_of_week as any, is_available: s.is_available, start_time: s.start_time ?? null, end_time: s.end_time ?? null },
        })
      )
    );
  }

  static async findLeave(leaveId: string, businessId: string) {
    return prisma.staffLeave.findFirst({
      where: { id: leaveId, staff: { business_id: businessId } },
      include: { staff: { include: { user: { select: { id: true } } } } },
    });
  }

  static async getPendingLeaves(businessId: string) {
    return prisma.staffLeave.findMany({
      where:   { status: "PENDING", staff: { business_id: businessId } },
      include: { staff: { select: { name: true, email: true, avatar_url: true } } },
      orderBy: { created_at: "asc" },
    });
  }

  static async countBookingsForStaffInRange(
    staffId:   string,
    startDate: Date,
    endDate:   Date
  ): Promise<number> {
    return prisma.booking.count({
      where: {
        staff_id:     staffId,
        status:       "CONFIRMED",
        service_date: { gte: startDate, lte: endDate },
      },
    });
  }

  static async countFutureBookings(staffId: string): Promise<number> {
    return prisma.booking.count({
      where: {
        staff_id:     staffId,
        status:       { in: ["CONFIRMED", "PENDING_PAYMENT"] },
        service_date: { gte: new Date() },
      },
    });
  }

  static async processLeave(leaveId: string, data: {
    status:           "APPROVED" | "REJECTED";
    approvedBy:       string;
    rejection_reason?: string;
  }) {
    return prisma.staffLeave.update({
      where: { id: leaveId },
      data:  {
        status:           data.status,
        approved_by:      data.approvedBy,
        approved_at:      new Date(),
        rejection_reason: data.rejection_reason,
      },
    });
  }
}