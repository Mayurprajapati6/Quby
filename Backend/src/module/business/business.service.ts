import { prisma } from "../../config/prisma";
import { BusinessRepository } from "./business.repository";
import { uploadImageBuffer, deleteFromCloudinary } from "../../utils/helpers/cloudinary";
import { emitToUser } from "../../socket/socket.service";

import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "../../utils/errors/app.error";
import { add, startOfDay }  from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type {
  BusinessProfileDTO,
  BusinessServiceItemDTO,
  ScheduleItemDTO,
  HolidayItemDTO,
  UpdateBusinessProfileDTO,
  AddServiceDTO,
  UpdateServiceDTO,
  CreateHolidayDTO,
} from "./business.types";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

export class BusinessService {

  static async getProfile(businessId: string): Promise<BusinessProfileDTO> {
    const biz = await BusinessRepository.findWithDetails(businessId);
    if (!biz) throw new NotFoundError("Business not found.");
    return this.toProfileDTO(biz);
  }

  static async updateProfile(
    businessId:  string,
    dto:         UpdateBusinessProfileDTO,
    files?:      { logo?: Express.Multer.File; cover?: Express.Multer.File },
  ): Promise<BusinessProfileDTO> {
    const biz = await BusinessRepository.findWithDetails(businessId);
    if (!biz) throw new NotFoundError("Business not found.");

    const updates: Record<string, any> = { ...dto };

    if (files?.logo) {
      if (biz.logo_url) {
        const m = biz.logo_url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
        if (m?.[1]) await deleteFromCloudinary(m[1]).catch(() => {});
      }
      updates.logo_url = (await uploadImageBuffer(files.logo, "LOGOS")).secure_url;
    }

    if (files?.cover) {
      if (biz.cover_image_url) {
        const m = biz.cover_image_url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
        if (m?.[1]) await deleteFromCloudinary(m[1]).catch(() => {});
      }
      updates.cover_image_url = (await uploadImageBuffer(files.cover, "COVERS")).secure_url;
    }

    await BusinessRepository.update(businessId, updates);
    return this.getProfile(businessId);
  }

  static async getServices(businessId: string): Promise<BusinessServiceItemDTO[]> {
    const services = await BusinessRepository.getServices(businessId);
    return services.map(this.toServiceDTO);
  }

  static async addService(businessId: string, dto: AddServiceDTO): Promise<BusinessServiceItemDTO> {
  
    const ps = await prisma.platformService.findUnique({ where: { id: dto.platform_service_id } });
    if (!ps) throw new NotFoundError("Platform service not found.");

    const existing = await prisma.businessServiceOffering.findFirst({
      where: { business_id: businessId, platform_service_id: dto.platform_service_id },
    });
    if (existing) throw new ConflictError("This service is already offered by your business.");

    const service = await BusinessRepository.addService(businessId, dto);
    return this.toServiceDTO(service);
  }

  static async updateService(
    serviceId:  string,
    businessId: string,
    dto:        UpdateServiceDTO,
  ): Promise<BusinessServiceItemDTO> {
    const existing = await BusinessRepository.findService(serviceId, businessId);
    if (!existing) throw new NotFoundError("Service not found.");

    await BusinessRepository.updateService(serviceId, dto);
    const services = await BusinessRepository.getServices(businessId);
    const updated  = services.find(s => s.id === serviceId)!;
    return this.toServiceDTO(updated);
  }

  static async deleteService(serviceId: string, businessId: string): Promise<void> {
    const existing = await BusinessRepository.findService(serviceId, businessId);
    if (!existing) throw new NotFoundError("Service not found.");

    const activeCount = await BusinessRepository.countActiveBookingsForService(serviceId, businessId);
    if (activeCount > 0) {
      throw new BadRequestError(
        `Cannot delete service: ${activeCount} active booking(s) exist for this business. ` +
        "Please complete or cancel them first."
      );
    }

    await BusinessRepository.deleteService(serviceId);
  }

  static async getSchedule(businessId: string): Promise<ScheduleItemDTO[]> {
    const schedules = await BusinessRepository.getSchedule(businessId);
    return schedules.map(s => ({
      id:          s.id,
      day_of_week: s.day_of_week,
      is_open:     s.is_open,
      open_time:   s.open_time  ?? null,
      close_time:  s.close_time ?? null,
    }));
  }

  static async updateSchedule(
    businessId: string,
    schedules:  Array<{
      day_of_week:  string;
      is_open:      boolean;
      open_time?:   string;
      close_time?:  string;
    }>,
  ): Promise<ScheduleItemDTO[]> {
    await BusinessRepository.upsertSchedule(businessId, schedules);
    return this.getSchedule(businessId);
  }

  static async getHolidays(businessId: string): Promise<HolidayItemDTO[]> {
    const holidays = await BusinessRepository.getHolidays(businessId);
    return holidays.map(h => ({
      id:                   h.id,
      holiday_name:         h.holiday_name,
      description:          h.description   ?? null,
      start_date:           toISTDate(h.start_date),
      end_date:             toISTDate(h.end_date),
      applies_to_all_staff: h.applies_to_all_staff,
      staff_count:          (h as any)._count?.staff_holidays ?? 0,
    }));
  }

  static async createHoliday(businessId: string, dto: CreateHolidayDTO): Promise<HolidayItemDTO> {
    const startDate = new Date(`${dto.start_date}T00:00:00+05:30`);
    const endDate   = new Date(`${dto.end_date}T00:00:00+05:30`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestError("Invalid date format. Use YYYY-MM-DD.");
    }
    if (endDate < startDate) {
      throw new BadRequestError("end_date must be on or after start_date.");
    }

    const appliesAll = dto.applies_to_all_staff ?? true;
    if (!appliesAll && (!dto.staff_ids || dto.staff_ids.length === 0)) {
      throw new BadRequestError("staff_ids required when applies_to_all_staff is false.");
    }

    const holiday = await BusinessRepository.createHoliday(businessId, {
      holiday_name:         dto.holiday_name,
      description:          dto.description,
      start_date:           startDate,
      end_date:             endDate,
      applies_to_all_staff: appliesAll,
      staff_ids:            dto.staff_ids,
    });

    await this.notifyStaffHoliday(businessId, appliesAll, dto.staff_ids ?? [], {
      type:    "HOLIDAY_CREATED",
      title:   "Holiday Announced 🎉",
      message: `${dto.holiday_name} — ${dto.start_date} to ${dto.end_date}.`,
    });

    return {
      id:                   holiday.id,
      holiday_name:         holiday.holiday_name,
      description:          holiday.description ?? null,
      start_date:           toISTDate(holiday.start_date),
      end_date:             toISTDate(holiday.end_date),
      applies_to_all_staff: holiday.applies_to_all_staff,
      staff_count:          dto.staff_ids?.length ?? 0,
    };
  }

  static async deleteHoliday(holidayId: string, businessId: string): Promise<void> {
    const holiday = await BusinessRepository.findHoliday(holidayId, businessId);
    if (!holiday) throw new NotFoundError("Holiday not found.");

    if (new Date(holiday.start_date) <= startOfDay(new Date())) {
      throw new BadRequestError("Only upcoming holidays (future start date) can be deleted.");
    }

    await BusinessRepository.deleteHoliday(holidayId);

    await this.notifyStaffHoliday(businessId, holiday.applies_to_all_staff, [], {
      type:    "BUSINESS_HOLIDAY",
      title:   "Holiday Cancelled",
      message: `${holiday.holiday_name} (${toISTDate(holiday.start_date)} – ${toISTDate(holiday.end_date)}) has been cancelled.`,
    });
  }

  private static toProfileDTO(biz: any): BusinessProfileDTO {
    return {
      id:               biz.id,
      business_name:    biz.business_name,
      slug:             biz.slug,
      business_type:    biz.business_type,
      service_for:      biz.service_for,
      description:      biz.description      ?? null,
      address_line1:    biz.address_line1,
      address_line2:    biz.address_line2     ?? null,
      city:             biz.city,
      state:            biz.state,
      pincode:          biz.pincode,
      map_link:         biz.map_link          ?? null,
      latitude:         biz.latitude          ?? null,
      longitude:        biz.longitude         ?? null,
      business_email:   biz.business_email    ?? null,
      business_phone:   biz.business_phone    ?? null,
      website_url:      biz.website_url        ?? null,
      instagram_url:    biz.instagram_url      ?? null,
      facebook_url:     biz.facebook_url       ?? null,
      twitter_url:      biz.twitter_url        ?? null,
      youtube_url:      biz.youtube_url        ?? null,
      whatsapp_number:  biz.whatsapp_number    ?? null,
      logo_url:         biz.logo_url           ?? null,
      cover_image_url:  biz.cover_image_url    ?? null,
      gallery: (biz.images ?? []).map((img: any) => ({
        id:         img.id,
        image_url:  img.image_url,
        is_primary: img.is_primary,
        sort_order: img.sort_order,
        caption:    img.caption ?? null,
      })),
      is_verified:         biz.is_verified,
      is_active:           biz.is_active,
      average_rating:      biz.average_rating  ?? 0,
      total_reviews:       biz.total_reviews   ?? 0,
      break_time_minutes:        biz.break_time_minutes,
      cancellation_window_hours: biz.cancellation_window_hours ?? 2,
      owner_name:          biz.owner?.name    ?? "",
      owner_phone:         biz.owner?.phone   ?? null,
      owner_avatar:        biz.owner?.avatar_url ?? null,
    };
  }

  private static toServiceDTO(s: any): BusinessServiceItemDTO {
    return {
      id: s.id,
      platform_service: {
        id:          s.platform_service.id,
        name:        s.platform_service.name,
        category:    s.platform_service.category  ?? null,
        service_for: s.platform_service.service_for,
      },
      price:            s.price,
      discounted_price: s.discounted_price ?? null,
      is_active:        s.is_active,
      is_featured:      s.is_featured,
      booking_count:    s.booking_count,
    };
  }

  private static async notifyStaffHoliday(
    businessId:  string,
    appliesAll:  boolean,
    staffIds:    string[],
    notif:       { type: string; title: string; message: string },
  ) {
    const staff = appliesAll
      ? await prisma.staff.findMany({
          where:  { business_id: businessId, is_active: true },
          select: { id: true, user: { select: { id: true } } },
        })
      : await prisma.staff.findMany({
          where:  { id: { in: staffIds }, business_id: businessId },
          select: { id: true, user: { select: { id: true } } },
        });

    const expiresAt = add(new Date(), { days: 30 });

    await Promise.allSettled(staff.map(async s => {
      await prisma.staffNotification.create({
        data: {
          staff_id:   s.id,
          type:       notif.type as any,
          title:      notif.title,
          message:    notif.message,
          expires_at: expiresAt,
        },
      }).catch(() => {});

      if (s.user?.id) {
        emitToUser(s.user.id, "holiday:update", { businessId, message: notif.message });
      }
    }));
  }
}