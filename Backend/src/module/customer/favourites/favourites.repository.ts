import { prisma } from "../../../config/prisma";
import { DayOfWeek } from "../../../../generated/prisma/enums";

function todayDayOfWeek(): DayOfWeek {
  const now  = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const days: DayOfWeek[] = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  return days[now.getDay()];
}

export class FavouritesRepository {

  static async findAll(customerId: string) {
    const dow = todayDayOfWeek();

    return prisma.customerFavourite.findMany({
      where:   { customer_id: customerId },
      orderBy: { created_at: "desc" },
      include: {
        business: {
          select: {
            id:            true,
            slug:          true,
            business_name: true,
            service_for:   true,
            city:          true,
            state:         true,
            address_line1: true,
            logo_url:      true,
            average_rating: true,
            total_reviews:  true,
            owner: {
              select: { name: true },
            },
            images: {
              where:  { is_primary: true },
              select: { image_url: true },
              take:   1,
            },
            schedules: {
              where:  { day_of_week: dow },
              select: { is_open: true, open_time: true, close_time: true },
              take:   1,
            },
          },
        },
      },
    });
  }

  static async findOne(customerId: string, businessId: string) {
    return prisma.customerFavourite.findUnique({
      where: { customer_id_business_id: { customer_id: customerId, business_id: businessId } },
    });
  }

  static async add(customerId: string, businessId: string) {
    return prisma.customerFavourite.create({
      data: { customer_id: customerId, business_id: businessId },
    });
  }

  static async remove(customerId: string, businessId: string) {
    return prisma.customerFavourite.deleteMany({
      where: { customer_id: customerId, business_id: businessId },
    });
  }

  static async exists(customerId: string, businessId: string): Promise<boolean> {
    const count = await prisma.customerFavourite.count({
      where: { customer_id: customerId, business_id: businessId },
    });
    return count > 0;
  }
}