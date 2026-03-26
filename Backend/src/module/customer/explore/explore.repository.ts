import { prisma } from "../../../config/prisma";
import { DayOfWeek } from "../../../../generated/prisma/enums";
import type { ExploreFilters } from "./explore.types";

function todayDayOfWeek(): DayOfWeek {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const days: DayOfWeek[] = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  return days[now.getDay()];
}

export class ExploreRepository {

  static async searchBusinesses(
    filters:       ExploreFilters,
    skip:          number,
    limit:         number,
    favouriteIds:  Set<string>   
  ) {
    const nameSearch = filters.name ?? filters.query;

    const where: any = {
      is_active:   true,
      is_verified: true,
      ...(nameSearch && {
        business_name: { contains: nameSearch, mode: "insensitive" },
      }),
      ...(filters.city        && { city:        { contains: filters.city,  mode: "insensitive" } }),
      ...(filters.state       && { state:        { contains: filters.state, mode: "insensitive" } }),
      ...(filters.service_for && { service_for:  filters.service_for }),
      ...(filters.min_rating  && { average_rating: { gte: filters.min_rating } }),
    };

    const dow = todayDayOfWeek();

    const [businesses, total] = await Promise.all([
      prisma.business.findMany({
        where,
        skip,
        take:    limit,
        
        orderBy: { average_rating: "desc" },
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
          latitude:       true,
          longitude:      true,

          owner: {
            select: { name: true },
          },

          images: {
            where:   { is_primary: true },
            select:  { image_url: true },
            take:    1,
          },

          schedules: {
            where:   { day_of_week: dow },
            select:  { is_open: true, open_time: true, close_time: true },
            take:    1,
          },
        },
      }),
      prisma.business.count({ where }),
    ]);

    return { businesses, total };
  }

  static async getFavouriteBusinessIds(customerId: string): Promise<Set<string>> {
    const favs = await prisma.customerFavourite.findMany({
      where:  { customer_id: customerId },
      select: { business_id: true },
    });
    return new Set(favs.map(f => f.business_id));
  }
}