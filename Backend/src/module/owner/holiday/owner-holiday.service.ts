import { prisma } from "../../../config/prisma";
import { OwnerHolidayRepository as Repo } from "./owner-holiday.repository";
import { emitToUser } from "../../../socket/socket.service";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import { add, startOfDay } from "date-fns";
import type {
  HolidayTab,
  HolidayItemDTO,
  CreateHolidayDTO,
  UpdateHolidayDTO,
} from "./owner-holiday.types";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function parseIST(s: string) { return new Date(`${s}T00:00:00+05:30`); }

export class OwnerHolidayService {

  private static async getBusinessIds(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return businesses.map(b => b.id);
  }

  private static tabOf(startDate: Date, endDate: Date): HolidayTab {
    const today = startOfDay(new Date());
    if (startDate > today) return "upcoming";
    if (endDate   < today) return "completed";
    return "running";
  }

  private static toDTO(h: any): HolidayItemDTO {
    return {
      id:                   h.id,
      business_id:          h.business_id,
      business_name:        h.business?.business_name ?? "",
      holiday_name:         h.holiday_name,
      description:          h.description ?? null,
      start_date:           toISTDate(h.start_date),
      end_date:             toISTDate(h.end_date),
      applies_to_all_staff: h.applies_to_all_staff,
      staff_ids:            (h.staff_holidays ?? []).map((sh: any) => sh.staff_id),
      staff_names:          (h.staff_holidays ?? []).map((sh: any) => sh.staff?.name ?? ""),
      tab:                  OwnerHolidayService.tabOf(h.start_date, h.end_date),
      created_at:           formatInTimeZone(h.created_at, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"),
    };
  }

  static async getHolidays(
    userId: string,
    tab:    HolidayTab,
    businessIdFilter?: string,
  ): Promise<HolidayItemDTO[]> {
    let businessIds = await this.getBusinessIds(userId);
    if (businessIdFilter) {
      if (!businessIds.includes(businessIdFilter)) throw new ForbiddenError("Business not found.");
      businessIds = [businessIdFilter];
    }

    const holidays = await Repo.findByTab(businessIds, tab);
    return holidays.map(this.toDTO);
  }

  static async createHoliday(userId: string, dto: CreateHolidayDTO): Promise<HolidayItemDTO> {
    const businessIds = await this.getBusinessIds(userId);
    if (!businessIds.includes(dto.business_id)) throw new ForbiddenError("Business not found.");

    const startDate = parseIST(dto.start_date);
    const endDate   = parseIST(dto.end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestError("Invalid date format. Use YYYY-MM-DD.");
    }
    if (endDate < startDate) {
      throw new BadRequestError("end_date must be on or after start_date.");
    }
    if (startDate <= startOfDay(new Date())) {
      throw new BadRequestError("Holidays can only be created with a future start_date.");
    }

    const appliesAll = dto.applies_to_all_staff ?? true;

    if (!appliesAll && (!dto.staff_ids || dto.staff_ids.length === 0)) {
      throw new BadRequestError("staff_ids required when applies_to_all_staff is false.");
    }

    const holiday = await Repo.create({
      business_id:          dto.business_id,
      holiday_name:         dto.holiday_name,
      description:          dto.description,
      start_date:           startDate,
      end_date:             endDate,
      applies_to_all_staff: appliesAll,
      staff_ids:            dto.staff_ids,
    });

    await this.notifyStaff(dto.business_id, appliesAll, dto.staff_ids ?? [], {
      type:    "HOLIDAY_CREATED",
      title:   "Holiday Announced 🎉",
      message: `${dto.holiday_name} — ${dto.start_date} to ${dto.end_date}.`,
      event:   "holiday:created",
    });

    await prisma.businessNotification.create({
      data: {
        business_id: dto.business_id,
        type:        "HOLIDAY_CREATED",
        title:       "Holiday Created",
        message:     `${dto.holiday_name} (${dto.start_date} – ${dto.end_date}) was added.`,
        target:      "BOTH",
        expires_at:  add(new Date(), { days: 60 }),
      },
    });

    const ownerInfo = await prisma.business.findUnique({
      where:  { id: dto.business_id },
      select: {
        business_name: true,
        owner: { select: { user: { select: { id: true } } } },
      },
    });
    if (ownerInfo?.owner?.user?.id) {
      await prisma.businessNotification.create({
        data: {
          business_id: dto.business_id,
          type:        "HOLIDAY_CREATED",
          title:       `Holiday Added — ${ownerInfo.business_name}`,
          message:     `${dto.holiday_name} (${dto.start_date} – ${dto.end_date}) created for ${ownerInfo.business_name}.`,
          target:      "OWNER",
          expires_at:  add(new Date(), { days: 60 }),
        },
      }).catch(() => {});

      emitToUser(ownerInfo.owner.user.id, "holiday:update", {
        action:       "created",
        holidayName:  dto.holiday_name,
        businessName: ownerInfo.business_name,
        startDate:    dto.start_date,
        endDate:      dto.end_date,
      });
    }

    return this.toDTO({ ...holiday, staff_holidays: [] });
  }

  static async updateHoliday(
    userId:    string,
    holidayId: string,
    dto:       UpdateHolidayDTO,
  ): Promise<HolidayItemDTO> {
    const businessIds = await this.getBusinessIds(userId);
    const existing    = await Repo.findByIdAndOwner(holidayId, businessIds);
    if (!existing) throw new NotFoundError("Holiday not found.");

    if (this.tabOf(existing.start_date, existing.end_date) !== "upcoming") {
      throw new BadRequestError("Only upcoming holidays can be edited.");
    }

    const updates: any = {};
    if (dto.holiday_name !== undefined) updates.holiday_name = dto.holiday_name;
    if (dto.description  !== undefined) updates.description  = dto.description;
    if (dto.applies_to_all_staff !== undefined) updates.applies_to_all_staff = dto.applies_to_all_staff;

    if (dto.start_date) {
      const d = parseIST(dto.start_date);
      if (d <= startOfDay(new Date())) throw new BadRequestError("start_date must be in the future.");
      updates.start_date = d;
    }
    if (dto.end_date) {
      updates.end_date = parseIST(dto.end_date);
    }

    const newStart = updates.start_date ?? existing.start_date;
    const newEnd   = updates.end_date   ?? existing.end_date;
    if (newEnd < newStart) throw new BadRequestError("end_date must be on or after start_date.");

    if (dto.staff_ids !== undefined) updates.staff_ids = dto.staff_ids;

    const updated = await Repo.update(holidayId, updates);

    const appliesAll = updated.applies_to_all_staff;
    await this.notifyStaff(existing.business_id, appliesAll, dto.staff_ids ?? [], {
      type:    "BUSINESS_HOLIDAY",
      title:   "Holiday Updated",
      message: `${updated.holiday_name} has been updated.`,
      event:   "holiday:updated",
    });

    const ownerInfoUpd = await prisma.business.findUnique({
      where:  { id: existing.business_id },
      select: { business_name: true, owner: { select: { user: { select: { id: true } } } } },
    });
    if (ownerInfoUpd?.owner?.user?.id) {
      await prisma.businessNotification.create({
        data: {
          business_id: existing.business_id,
          type:        "HOLIDAY_CREATED",
          title:       `Holiday Updated — ${ownerInfoUpd.business_name}`,
          message:     `${updated.holiday_name} has been updated.`,
          target:      "OWNER",
          expires_at:  add(new Date(), { days: 30 }),
        },
      }).catch(() => {});
      emitToUser(ownerInfoUpd.owner.user.id, "holiday:update", {
        action:       "updated",
        holidayId,
        holidayName:  updated.holiday_name,
        businessName: ownerInfoUpd.business_name,
      });
    }

    return this.toDTO({ ...updated, staff_holidays: existing.staff_holidays });
  }

  static async deleteHoliday(userId: string, holidayId: string): Promise<void> {
    const businessIds = await this.getBusinessIds(userId);
    const existing    = await Repo.findByIdAndOwner(holidayId, businessIds);
    if (!existing) throw new NotFoundError("Holiday not found.");

    if (this.tabOf(existing.start_date, existing.end_date) !== "upcoming") {
      throw new BadRequestError("Only upcoming holidays can be deleted.");
    }

    await Repo.delete(holidayId);

    const appliesAll = existing.applies_to_all_staff;
    const staffIds   = (existing.staff_holidays ?? []).map((sh: any) => sh.staff_id);
    await this.notifyStaff(existing.business_id, appliesAll, staffIds, {
      type:    "BUSINESS_HOLIDAY",
      title:   "Holiday Cancelled",
      message: `${existing.holiday_name} (${toISTDate(existing.start_date)} – ${toISTDate(existing.end_date)}) has been cancelled.`,
      event:   "holiday:cancelled",
    });

    const ownerInfoDel = await prisma.business.findUnique({
      where:  { id: existing.business_id },
      select: { business_name: true, owner: { select: { user: { select: { id: true } } } } },
    });
    if (ownerInfoDel?.owner?.user?.id) {
      await prisma.businessNotification.create({
        data: {
          business_id: existing.business_id,
          type:        "HOLIDAY_CREATED",
          title:       `Holiday Removed — ${ownerInfoDel.business_name}`,
          message:     `${existing.holiday_name} has been removed.`,
          target:      "OWNER",
          expires_at:  add(new Date(), { days: 30 }),
        },
      }).catch(() => {});
      emitToUser(ownerInfoDel.owner.user.id, "holiday:update", {
        action:       "deleted",
        holidayId,
        holidayName:  existing.holiday_name,
        businessName: ownerInfoDel.business_name,
      });
    }
  }

  private static async notifyStaff(
    businessId:   string,
    appliesAll:   boolean,
    targetIds:    string[],
    notification: { type: string; title: string; message: string; event: string },
  ) {
    const staff = appliesAll
      ? await Repo.getStaffForBusiness(businessId)
      : await prisma.staff.findMany({
          where:  { id: { in: targetIds }, business_id: businessId },
          select: { id: true, name: true, email: true, user: { select: { id: true } } },
        });

    const expiresAt = add(new Date(), { days: 30 });

    await Promise.allSettled(
      staff.map(async s => {
        await prisma.staffNotification.create({
          data: {
            staff_id:   s.id,
            type:       notification.type as any,
            title:      notification.title,
            message:    notification.message,
            expires_at: expiresAt,
          },
        }).catch(() => {});

        if (s.user?.id) {
          emitToUser(s.user.id, notification.event, { businessId, message: notification.message });
        }
      })
    );
  }
}
