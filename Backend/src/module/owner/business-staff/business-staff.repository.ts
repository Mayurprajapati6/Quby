import { prisma } from "../../../config/prisma";
import { generateAvatarUrl } from "../../../utils/helpers/avatar";
import { startOfDay } from "date-fns";

export class BusinessStaffRepository {

  static async getOwnerBusinessIds(userId: string): Promise<string[]> {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) return [];

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return businesses.map(b => b.id);
  }

  static async findAllByBusiness(
    businessId: string,
    filters: { name?: string } = {},
  ) {
    const today = startOfDay(new Date());

    const staff = await prisma.staff.findMany({
      where: {
        business_id: businessId,
        ...(filters.name && { name: { contains: filters.name, mode: "insensitive" } }),
      },
      include: {
        user:      { select: { id: true } },
        services:  { include: { service_offering: { include: { platform_service: { select: { name: true, image_url: true } } } } } },
        schedules: true,
        _count:    { select: { bookings: { where: { service_date: today } } } },
      },
      orderBy: { created_at: "asc" },
    });

    return staff;
  }

  static async findAllByOwner(
    userId:  string,
    filters: { name?: string; business_id?: string },
  ) {
    const businessIds = await this.getOwnerBusinessIds(userId);
    if (!businessIds.length) return [];

    const where: any = {
      business_id: {
        in: filters.business_id
          ? [filters.business_id].filter(id => businessIds.includes(id))
          : businessIds,
      },
      ...(filters.name && { name: { contains: filters.name, mode: "insensitive" } }),
    };

    const today = startOfDay(new Date());

    return prisma.staff.findMany({
      where,
      include: {
        business: {
  select: {
    id: true,
    business_name: true,
    logo_url: true, // ✅ ADD
  },
},
        user:     { select: { id: true } },
        _count:   { select: { bookings: { where: { service_date: today } } } },
      },
      orderBy: [{ business_id: "asc" }, { name: "asc" }],
    });
  }

  static async findByOwnerAndStaff(userId: string, staffId: string) {
  const businessIds = await this.getOwnerBusinessIds(userId);
  if (!businessIds.length) return null;

  // ✅ 1. Fetch staff
  const staff = await prisma.staff.findFirst({
    where: { id: staffId, business_id: { in: businessIds } },
    include: {
      business: {
  select: {
    id: true,
    business_name: true,
    logo_url: true, // ✅ ADD
  },
},
      user: { select: { id: true, email: true } },
      services: {
        include: {
          service_offering: {
            include: {
              platform_service: {
                select: { id: true, name: true, category: true, image_url: true },
              },
            },
          },
        },
      },
      schedules: { orderBy: { day_of_week: "asc" } },
    },
  });

  if (!staff) return null;

  // ✅ 2. LIFETIME STATS (THIS IS WHAT YOU WANT)
  const stats = await prisma.booking.aggregate({
    where: {
      staff_id: staffId,
      status: "COMPLETED",
    },
    _count: { id: true },
    _sum: { service_amount: true },
  });

  

  // ✅ 3. RETURN WITH STATS (THIS WAS MISSING)
  return {
    ...staff,
    stats: {
      completed_bookings: stats._count.id ?? 0,
      revenue_inr: stats._sum.service_amount ?? 0,
    },
  };
}

  static async createStaffWithUser(data: {
    business_id:       string;
    name:              string;
    email:             string;
    phone:             string;
    specialization?:   string;
    experience_years?: number;
    bio?:              string;
  }) {
    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: data.email, role: "STAFF", version: 1 },
      });

      const staff = await tx.staff.create({
        data: {
          user_id:          user.id,
          business_id:      data.business_id,
          name:             data.name,
          email:            data.email,
          phone:            data.phone,
          specialization:   data.specialization,
          experience_years: data.experience_years,
          bio:              data.bio,
          avatar_url:       generateAvatarUrl(data.name),
        },
      });

      return { user, staff };
    });
  }

  static async updateStaff(staffId: string, data: Record<string, any>) {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) payload[k] = v;
    }
    return prisma.staff.update({ where: { id: staffId }, data: payload });
  }

  static async replaceStaffServices(
    staffId:  string,
    services: Array<{ service_offering_id: string; duration_minutes: number; is_available?: boolean }>,
  ) {
    await prisma.$transaction([
      prisma.staffService.deleteMany({ where: { staff_id: staffId } }),
      prisma.staffService.createMany({
        data: services.map(s => ({
          staff_id:            staffId,
          service_offering_id: s.service_offering_id,
          duration_minutes:    s.duration_minutes,
          is_available:        s.is_available ?? true,
        })),
      }),
    ]);
  }

  static async replaceStaffSchedule(
    staffId:  string,
    schedule: Array<{ day_of_week: string; is_available: boolean; start_time?: string; end_time?: string }>,
  ) {
    await prisma.$transaction([
      prisma.staffSchedule.deleteMany({ where: { staff_id: staffId } }),
      prisma.staffSchedule.createMany({
        data: schedule.map(s => ({
          staff_id:     staffId,
          day_of_week:  s.day_of_week as any,
          is_available: s.is_available,
          start_time:   s.start_time ?? null,
          end_time:     s.end_time   ?? null,
        })),
      }),
    ]);
  }

  static async setActiveStatus(staffId: string, is_active: boolean) {
    return prisma.staff.update({ where: { id: staffId }, data: { is_active } });
  }

  static async deleteStaff(staffId: string) {
    
    const staff = await prisma.staff.findUnique({
      where:  { id: staffId },
      select: { user_id: true },
    });
    if (staff?.user_id) {
      await prisma.user.delete({ where: { id: staff.user_id } });
    }
  }

  static async getLeaveRequests(businessIds: string[], status?: string) {
    return prisma.staffLeave.findMany({
      where: {
        staff: { business_id: { in: businessIds } },
        ...(status && { status: status as any }),
      },
      include: {
        staff: {
          select: {
            id:           true,
            name:         true,
            email:        true,
            avatar_url:   true,
            business:     { select: { id: true, business_name: true } },
            user:         { select: { id: true } },
          },
        },
      },
      orderBy: { created_at: "desc" },
    });
  }

  static async findLeave(leaveId: string, businessIds: string[]) {
    return prisma.staffLeave.findFirst({
      where: {
        id:    leaveId,
        staff: { business_id: { in: businessIds } },
      },
      include: {
        staff: {
          select: { id: true, name: true, email: true, user: { select: { id: true } } },
        },
      },
    });
  }

  static async processLeave(
    leaveId:          string,
    action:           "APPROVED" | "REJECTED",
    approverId:       string,
    rejection_reason?: string,
  ) {
    return prisma.staffLeave.update({
      where: { id: leaveId },
      data: {
        status:           action,
        approved_by:      approverId,
        approved_at:      new Date(),
        rejection_reason: action === "REJECTED" ? rejection_reason : null,
      },
    });
  }
}