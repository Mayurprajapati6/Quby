import { StaffRepository } from "./staff.repository";
import { uploadImageBuffer, deleteFromCloudinary } from "../../utils/helpers/cloudinary";
import { verifyPassword } from "../../utils/helpers/crypto";
import { prisma } from "../../config/prisma";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  BadRequestError,
  UnauthorizedError,
} from "../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

function toDTO(s: any) {
  return {
    id:               s.id,
    name:             s.name,
    email:            s.email,
    phone:            s.phone          ?? null,
    avatar_url:       s.avatar_url     ?? null,
    bio:              s.bio            ?? null,
    specialization:   s.specialization ?? null,
    experience_years: s.experience_years ?? null,
    city:             s.city           ?? null,
    state:            s.state          ?? null,
    is_active:        s.is_active,
    is_verified:      s.is_verified,
    average_rating:   s.average_rating  ?? 0,
    total_reviews:    s.total_reviews   ?? 0,
    join_date:        toISTDate(s.created_at),
    business: {
      id:            s.business.id,
      business_name: s.business.business_name,
      logo_url:      s.business.logo_url ?? null,
      owner_name:    s.business.owner?.name    ?? null,
      owner_phone:   s.business.owner?.phone   ?? null,
      owner_avatar:  s.business.owner?.avatar_url ?? null,
    },
    services: (s.services ?? []).map((sv: any) => ({
      id:               sv.id,
      name:             sv.service_offering.platform_service.name,
      category:         sv.service_offering.platform_service.category ?? null,
      image_url:        sv.service_offering.platform_service.image_url ?? null,
      price:            sv.service_offering.price ? Math.round(sv.service_offering.price / 100) : null,
      discounted_price: sv.service_offering.discounted_price ? Math.round(sv.service_offering.discounted_price / 100) : null,
      duration_minutes: sv.duration_minutes,
      is_available:     sv.is_available,
    })),
    schedule: (s.schedules ?? []).map((sc: any) => ({
      day_of_week:  sc.day_of_week,
      is_available: sc.is_available,
      start_time:   sc.start_time ?? null,
      end_time:     sc.end_time   ?? null,
    })),
  };
}

export class StaffService {

  static async getProfile(userId: string) {
    const staff = await StaffRepository.findByUserId(userId);
    if (!staff)          throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
    return toDTO(staff);
  }

  static async updateProfile(
    userId:      string,
    data:        {
      name?:             string;
      phone?:            string;
      bio?:              string;
      specialization?:   string;
      experience_years?: number;
      city?:             string;
      state?:            string;
    },
    avatarFile?: Express.Multer.File,
  ) {
    const staff = await StaffRepository.findByUserId(userId);
    if (!staff)          throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");

    if (data.phone) {
      const existing = await StaffRepository.findByPhone(data.phone);
      if (existing && existing.id !== staff.id) {
        throw new ConflictError("This phone number is already in use.");
      }
    }

    let avatarUrl: string | undefined;
    if (avatarFile) {
      if (staff.avatar_url) {
        const m = staff.avatar_url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
        if (m?.[1]) await deleteFromCloudinary(m[1]).catch(() => {});
      }
      const uploaded = await uploadImageBuffer(avatarFile, "PROFILES");
      avatarUrl = uploaded.secure_url;
    }

    const updated = await StaffRepository.updateProfile(staff.id, {
      ...data,
      ...(avatarUrl && { avatar_url: avatarUrl }),
    });

    return toDTO(updated);
  }

  static async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, password_hash: true },
    });
    if (!user) throw new NotFoundError("Account not found.");
    if (!user.password_hash) throw new BadRequestError("Account setup is incomplete.");

    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) throw new UnauthorizedError("Incorrect password.");

    await prisma.user.delete({ where: { id: userId } });
  }
}