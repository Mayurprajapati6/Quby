import { prisma } from "../../config/prisma";


export class BusinessRepository {

  static async findWithDetails(businessId: string) {
    return prisma.business.findUnique({
      where:   { id: businessId },
      include: {
        images:   { orderBy: { sort_order: "asc" } },
        schedules: true,
        owner: {
          select: { name: true, phone: true, avatar_url: true },
        },
      },
    });
  }

  static async update(businessId: string, data: Record<string, any>) {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) payload[k] = v;
    }
    return prisma.business.update({ where: { id: businessId }, data: payload });
  }

  static async getServices(businessId: string) {
    return prisma.businessServiceOffering.findMany({
      where:   { business_id: businessId },
      include: {
        platform_service: {
          select: { id: true, name: true, category: true, service_for: true },
        },
      },
      orderBy: [{ is_featured: "desc" }, { is_active: "desc" }, { created_at: "asc" }],
    });
  }

  static async findService(serviceId: string, businessId: string) {
    return prisma.businessServiceOffering.findFirst({
      where: { id: serviceId, business_id: businessId },
    });
  }

  static async addService(businessId: string, data: {
    platform_service_id: string;
    price:               number;
    discounted_price?:   number;
    is_featured?:        boolean;
  }) {
    return prisma.businessServiceOffering.create({
      data: {
        business_id:         businessId,
        platform_service_id: data.platform_service_id,
        price:               data.price,
        discounted_price:    data.discounted_price ?? null,
        is_featured:         data.is_featured       ?? false,
      },
      include: {
        platform_service: {
          select: { id: true, name: true, category: true, service_for: true },
        },
      },
    });
  }

  static async updateService(serviceId: string, data: Record<string, any>) {
    const payload: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) payload[k] = v;
    }
    return prisma.businessServiceOffering.update({
      where: { id: serviceId },
      data:  payload,
    });
  }

  static async deleteService(serviceId: string) {
    return prisma.businessServiceOffering.delete({ where: { id: serviceId } });
  }

  static async getSchedule(businessId: string) {
    return prisma.businessSchedule.findMany({
      where:   { business_id: businessId },
      orderBy: { day_of_week: "asc" },
    });
  }

  static async upsertSchedule(
    businessId: string,
    schedules:  Array<{
      day_of_week:  string;
      is_open:      boolean;
      open_time?:   string;
      close_time?:  string;
    }>,
  ) {
    return prisma.$transaction(
      schedules.map(s =>
        prisma.businessSchedule.upsert({
          where:  {
            business_id_day_of_week: {
              business_id: businessId,
              day_of_week: s.day_of_week as any,
            },
          },
          create: {
            business_id: businessId,
            day_of_week: s.day_of_week as any,
            is_open:     s.is_open,
            open_time:   s.open_time  ?? null,
            close_time:  s.close_time ?? null,
          },
          update: {
            is_open:    s.is_open,
            open_time:  s.open_time  ?? null,
            close_time: s.close_time ?? null,
          },
        })
      )
    );
  }

  static async getHolidays(businessId: string) {
    return prisma.holiday.findMany({
      where:   { business_id: businessId },
      include: { _count: { select: { staff_holidays: true } } },
      orderBy: { start_date: "asc" },
    });
  }

  static async createHoliday(businessId: string, data: {
    holiday_name:         string;
    description?:         string;
    start_date:           Date;
    end_date:             Date;
    applies_to_all_staff: boolean;
    staff_ids?:           string[];
  }) {
    return prisma.$transaction(async (tx) => {
      const holiday = await tx.holiday.create({
        data: {
          business_id:          businessId,
          holiday_name:         data.holiday_name,
          description:          data.description ?? null,
          start_date:           data.start_date,
          end_date:             data.end_date,
          applies_to_all_staff: data.applies_to_all_staff,
        },
      });

      if (!data.applies_to_all_staff && data.staff_ids?.length) {
        await tx.staffHoliday.createMany({
          data: data.staff_ids.map(sid => ({
            holiday_id: holiday.id,
            staff_id:   sid,
          })),
          skipDuplicates: true,
        });
      }

      return holiday;
    });
  }

  static async findHoliday(holidayId: string, businessId: string) {
    return prisma.holiday.findFirst({
      where: { id: holidayId, business_id: businessId },
    });
  }

  static async deleteHoliday(holidayId: string) {
    return prisma.holiday.delete({ where: { id: holidayId } });
  }

  static async countActiveBookingsForService(serviceId: string, businessId: string) {
    return prisma.booking.count({
      where: {
        business_id: businessId,
        status:      { in: ["CONFIRMED", "RUNNING"] },
      },
    });
  }
}
