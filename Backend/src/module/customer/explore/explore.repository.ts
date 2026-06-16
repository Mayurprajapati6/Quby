import { prisma } from "../../../config/prisma";
import { DayOfWeek } from "../../../../generated/prisma/enums";
import { formatInTimeZone } from "date-fns-tz";
import type { ExploreFilters } from "./explore.types";

const TZ = "Asia/Kolkata";

function todayDayOfWeek(): DayOfWeek {
  const dayName = formatInTimeZone(new Date(), TZ, "EEEE").toUpperCase();
  return dayName as DayOfWeek;
}

export class ExploreRepository {

  static async searchBusinesses(
    filters:       ExploreFilters,
    skip:          number,
    limit:         number,   
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

  
}