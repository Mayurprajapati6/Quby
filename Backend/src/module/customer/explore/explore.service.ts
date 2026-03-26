import { ExploreRepository } from "./explore.repository";
import { haversineDistance } from "../../../utils/helpers/haversine";
import type {
  ExploreFilters,
  BusinessCardDTO,
  ExploreResponse,
} from "./explore.types";

function nowIST(): { hours: number; minutes: number; dayOfWeek: string } {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );
  const days = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];
  return {
    hours:     now.getHours(),
    minutes:   now.getMinutes(),
    dayOfWeek: days[now.getDay()],
  };
}

function checkIsOpenNow(
  schedule: { is_open: boolean; open_time: string | null; close_time: string | null } | undefined
): boolean {
  if (!schedule?.is_open || !schedule.open_time || !schedule.close_time) return false;

  const { hours, minutes } = nowIST();
  const nowMins = hours * 60 + minutes;

  const [oh, om] = schedule.open_time.split(":").map(Number);
  const [ch, cm] = schedule.close_time.split(":").map(Number);

  return nowMins >= oh * 60 + om && nowMins < ch * 60 + cm;
}

export class ExploreService {

  static async searchBusinesses(
    filters:    ExploreFilters,
    customerId: string   
  ): Promise<ExploreResponse> {
    const page  = Math.max(1, filters.page  ?? 1);
    const limit = Math.min(50, filters.limit ?? 10);
    const skip  = (page - 1) * limit;

    const favouriteIds: Set<string> = customerId
      ? await ExploreRepository.getFavouriteBusinessIds(customerId)
      : new Set();

    const { businesses, total } =
      await ExploreRepository.searchBusinesses(filters, skip, limit, favouriteIds);

    let mapped: BusinessCardDTO[] = businesses.map(b => {
      const todaySched = (b as any).schedules?.[0] ?? undefined;
      const primaryImg = (b as any).images?.[0]?.image_url ?? b.logo_url ?? null;
      const isFav      = favouriteIds.has(b.id);

      let distanceKm: number | undefined;
      if (filters.lat != null && filters.lng != null && b.latitude && b.longitude) {
        distanceKm = haversineDistance(filters.lat, filters.lng, b.latitude, b.longitude);
      }

      return {
        id:             b.id,
        slug:           b.slug,
        business_name:  b.business_name,
        owner_name:     (b as any).owner?.name ?? "",
        service_for:    b.service_for,
        city:           b.city,
        state:          b.state,
        address_line1:  b.address_line1,
        primary_image:  primaryImg,
        average_rating: b.average_rating ?? 0,
        total_reviews:  b.total_reviews ?? 0,
        opening_time:   todaySched?.open_time   ?? null,
        closing_time:   todaySched?.close_time  ?? null,
        is_open_now:    checkIsOpenNow(todaySched),
        is_favourite:   isFav,
        distance_km:    distanceKm,
      };
    });

    if (filters.lat != null && filters.lng != null && filters.radius_km != null) {
      mapped = mapped.filter(b => (b.distance_km ?? Infinity) <= filters.radius_km!);
    }

    const favs    = mapped.filter(b => b.is_favourite);
    const nonFavs = mapped.filter(b => !b.is_favourite);

    function sortGroup(arr: BusinessCardDTO[]): BusinessCardDTO[] {
      if (filters.lat != null && filters.lng != null) {
        return arr.slice().sort((a, b) =>
          (a.distance_km ?? Infinity) - (b.distance_km ?? Infinity)
        );
      }
      return arr.slice().sort((a, b) =>
        (b.average_rating ?? 0) - (a.average_rating ?? 0)
      );
    }

    mapped = [...sortGroup(favs), ...sortGroup(nonFavs)];

    return {
      businesses: mapped,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    };
  }
}
