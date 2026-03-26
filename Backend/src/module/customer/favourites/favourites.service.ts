import { FavouritesRepository }  from "./favourites.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { prisma } from "../../../config/prisma";
import type {
  FavouriteBusinessDTO,
  ToggleFavouriteResponseDTO,
} from "./favourites.types";

function isOpenNow(
  schedule: { is_open: boolean; open_time: string | null; close_time: string | null } | undefined
): boolean {
  if (!schedule?.is_open || !schedule.open_time || !schedule.close_time) return false;

  const now  = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const nowM = now.getHours() * 60 + now.getMinutes();

  const [oh, om] = schedule.open_time.split(":").map(Number);
  const [ch, cm] = schedule.close_time.split(":").map(Number);

  return nowM >= oh * 60 + om && nowM < ch * 60 + cm;
}

export class FavouritesService {

  static async getAll(userId: string): Promise<FavouriteBusinessDTO[]> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const favourites = await FavouritesRepository.findAll(customer.id);

    return favourites.map(f => {
      const b         = (f as any).business;
      const sched     = b.schedules?.[0];
      const primaryImg = b.images?.[0]?.image_url ?? b.logo_url ?? null;

      return {
        id:             f.id,
        business_id:    f.business_id,
        business_name:  b.business_name,
        owner_name:     (b as any).owner?.name ?? "",
        slug:           b.slug,
        service_for:    b.service_for,
        city:           b.city,
        state:          b.state,
        address_line1:  b.address_line1,
        primary_image:  primaryImg,
        average_rating: b.average_rating ?? 0,
        total_reviews:  b.total_reviews  ?? 0,
        opening_time:   sched?.open_time  ?? null,
        closing_time:   sched?.close_time ?? null,
        is_open_now:    isOpenNow(sched),
        added_at:       f.created_at,
      };
    });
  }

  static async toggle(
    userId:     string,
    businessId: string
  ): Promise<ToggleFavouriteResponseDTO> {
    const customer = await prisma.customer.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!customer) throw new NotFoundError("Customer not found.");

    const business = await prisma.business.findUnique({
      where:  { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundError("Business not found.");

    const exists = await FavouritesRepository.exists(customer.id, businessId);

    if (exists) {
      await FavouritesRepository.remove(customer.id, businessId);
      return { favourited: false, business_id: businessId };
    } else {
      await FavouritesRepository.add(customer.id, businessId);
      return { favourited: true, business_id: businessId };
    }
  }
}
