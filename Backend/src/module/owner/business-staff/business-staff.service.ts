import { prisma } from "../../../config/prisma";
import { BusinessStaffRepository } from "./business-staff.repository";
import { uploadImageBuffer, deleteFromCloudinary } from "../../../utils/helpers/cloudinary";
import { generateToken, hashToken } from "../../../utils/helpers/crypto";
import { queueEmail } from "../../../services/email.services";
import { emitToUser } from "../../../socket/socket.service";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { add } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type {
  CreateStaffDTO,
  UpdateStaffDTO,
  UpdateStaffServicesDTO,
  UpdateStaffScheduleDTO,
} from "./business-staff.types";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
export class BusinessStaffService {

  private static async getBusinessIds(userId: string): Promise<string[]> {
    const ids = await BusinessStaffRepository.getOwnerBusinessIds(userId);
    if (!ids.length) throw new NotFoundError("No businesses found for this owner.");
    return ids;
  }

  static async getStaffAcrossBusinesses(
    userId:  string,
    filters: { name?: string; business_id?: string },
  ) {
    const staff = await BusinessStaffRepository.findAllByOwner(userId, filters);

    return staff.map(s => ({
      id:               s.id,
      name:             s.name,
      email:            s.email,
      phone:            s.phone        ?? null,
      avatar_url:       s.avatar_url   ?? null,
      specialization:   s.specialization ?? null,
      experience_years: s.experience_years ?? null,
      is_active:        s.is_active,
      setup_complete:   !!(s as any).setup_complete,
      average_rating:   s.average_rating ?? 0,
      total_reviews:    s.total_reviews  ?? 0,
      today_bookings:   (s as any)._count?.bookings ?? 0,
      business_id:      s.business.id,
      business_name:    s.business.business_name,
      business_logo: s.business.logo_url ?? null,
joined_date: s.created_at,
    }));
  }

  static async getStaffByBusiness(userId: string, businessId: string) {
    const businessIds = await this.getBusinessIds(userId);
    if (!businessIds.includes(businessId)) throw new ForbiddenError("Business not found.");

    const staff = await BusinessStaffRepository.findAllByBusiness(businessId);
    return staff.map(s => ({
      id:               s.id,
      name:             s.name,
      email:            s.email,
      phone:            s.phone        ?? null,
      avatar_url:       s.avatar_url   ?? null,
      specialization:   s.specialization ?? null,
      experience_years: s.experience_years ?? null,
      is_active:        s.is_active,
      setup_complete:   !!(s as any).setup_complete,
      average_rating:   s.average_rating ?? 0,
      total_reviews:    s.total_reviews  ?? 0,
      today_bookings:   (s as any)._count?.bookings ?? 0,
      joined_date: s.created_at,
    }));
  }

  static async getStaff(userId: string, staffId: string) {
  const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);

  if (!staff) throw new NotFoundError("Staff member not found.");

  // ✅ FIX: convert paise → rupees
  const stats = staff.stats
    ? {
        ...staff.stats,
        revenue_inr: Math.floor((staff.stats.revenue_inr ?? 0) / 100),
      }
    : null;

  return {
  ...staff,
  business_logo: staff.business.logo_url ?? null,
  stats,
};
}

  static async createStaff(
    userId:      string,
    businessId:  string,
    dto:         CreateStaffDTO,
    avatarFile?: Express.Multer.File,
  ) {
    const businessIds = await this.getBusinessIds(userId);
    if (!businessIds.includes(businessId)) throw new ForbiddenError("Business not found.");

    const existing = await prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictError("A user with this email already exists.");

    const { user, staff } = await BusinessStaffRepository.createStaffWithUser({
      business_id:       businessId,
      name:              dto.name,
      email:             dto.email,
      phone:             dto.phone,
      specialization:    dto.specialization,
      experience_years:  dto.experience_years,
      bio:               dto.bio,
    });

    if (avatarFile) {
      const r = await uploadImageBuffer(avatarFile, "PROFILES");
      await BusinessStaffRepository.updateStaff(staff.id, { avatar_url: r.secure_url });
    }

    if (dto.services?.length) {
      await BusinessStaffRepository.replaceStaffServices(staff.id, dto.services);
    }

    if (dto.schedule?.length) {
      await BusinessStaffRepository.replaceStaffSchedule(staff.id, dto.schedule);
    }

    await this.sendInvitation(user.id, dto.email, dto.name, businessId);

    return staff;
  }

  static async updateStaff(
    userId:      string,
    staffId:     string,
    dto:         UpdateStaffDTO,
    avatarFile?: Express.Multer.File,
  ) {
    const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    let avatar_url = staff.avatar_url;
    if (avatarFile) {
      if (staff.avatar_url) {
        const m = staff.avatar_url.match(/\/upload\/(?:v\d+\/)?(.+?)(\.\w+)?$/);
        if (m?.[1]) await deleteFromCloudinary(m[1]).catch(() => {});
      }
      avatar_url = (await uploadImageBuffer(avatarFile, "PROFILES")).secure_url;
    }

    return BusinessStaffRepository.updateStaff(staffId, { ...dto, avatar_url });
  }

  static async updateStaffServices(userId: string, staffId: string, dto: UpdateStaffServicesDTO) {
    const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    const offeringIds = dto.services.map(s => s.service_offering_id);
    const count       = await prisma.businessServiceOffering.count({
      where: { id: { in: offeringIds }, business_id: staff.business.id },
    });
    if (count !== offeringIds.length) {
      throw new BadRequestError("One or more services do not belong to this business.");
    }

    await BusinessStaffRepository.replaceStaffServices(staffId, dto.services);
    return { updated: offeringIds.length };
  }

  static async updateStaffSchedule(userId: string, staffId: string, dto: UpdateStaffScheduleDTO) {
    const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    await BusinessStaffRepository.replaceStaffSchedule(staffId, dto.schedule);
    return { updated: dto.schedule.length };
  }

  static async toggleActive(userId: string, staffId: string, is_active: boolean) {
    const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    if (!is_active) {
      
      const activeCount = await prisma.booking.count({
        where: {
          staff_id: staffId,
          status:   { in: ["CONFIRMED", "RUNNING"] },
        },
      });
      if (activeCount > 0) {
        throw new BadRequestError(
          `Cannot deactivate: ${activeCount} active booking(s) exist for this staff.`
        );
      }
    }

    await BusinessStaffRepository.setActiveStatus(staffId, is_active);
    return { staff_id: staffId, is_active };
  }

  static async deleteStaff(userId: string, staffId: string) {
    const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    const activeCount = await prisma.booking.count({
      where: { staff_id: staffId, status: { in: ["CONFIRMED", "RUNNING"] } },
    });
    if (activeCount > 0) {
      throw new BadRequestError(
        `Cannot remove staff: ${activeCount} active booking(s) pending.`
      );
    }

    await BusinessStaffRepository.deleteStaff(staffId);
  }

  static async resendInvitation(userId: string, staffId: string) {
    const staff = await BusinessStaffRepository.findByOwnerAndStaff(userId, staffId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    const user = await prisma.user.findUnique({
      where:  { id: staff.user.id },
      select: { id: true, password_hash: true },
    });
    if (user?.password_hash) {
      throw new BadRequestError("This staff member has already completed account setup.");
    }

    await prisma.emailVerificationToken.updateMany({
      where: { user_id: staff.user.id, used_at: null },
      data:  { used_at: new Date() },
    });

    const rawToken    = generateToken();
    const hashedToken = hashToken(rawToken);
    const expiresAt   = add(new Date(), { hours: 48 });

    await prisma.emailVerificationToken.create({
      data: {
        user_id:    staff.user.id,
        token:      hashedToken,
        expires_at: expiresAt,
      },
    });

    const setupUrl = `${process.env.CLIENT_URL}/staff/setup?token=${rawToken}`;
    const business = await prisma.business.findUnique({
      where:  { id: staff.business.id },
      select: { business_name: true, owner: { select: { name: true } } },
    });

    queueEmail({
      to:   staff.email,
      type: "staff-reinvitation",
      data: {
        staffName:    staff.name,
        businessName: business?.business_name ?? "Your employer",
        setupUrl,
        expiresAt:    expiresAt.toISOString(),
      },
    }).catch(err => logger.warn("[BusinessStaff] Reinvitation email failed:", err));

    return { resent: true };
  }

  static async getLeaveRequests(
    userId:  string,
    filters: { status?: string; business_id?: string },
  ) {
    let businessIds = await this.getBusinessIds(userId);
    if (filters.business_id) {
      businessIds = businessIds.filter(id => id === filters.business_id);
    }

    const leaves = await BusinessStaffRepository.getLeaveRequests(businessIds, filters.status);

    return leaves.map(l => ({
      id:               l.id,
      staff_id:         l.staff_id,
      staff_name:       l.staff.name,
      staff_avatar:     l.staff.avatar_url ?? null,
      business_id:      l.staff.business.id,
      business_name:    l.staff.business.business_name,
      leave_type:       l.leave_type,
      start_date:       toISTDate(l.start_date),
      end_date:         toISTDate(l.end_date),
      reason:           l.reason          ?? null,
      status:           l.status,
      rejection_reason: l.rejection_reason ?? null,
      created_at:       toISTDate(l.created_at),
    }));
  }

  static async processLeave(
    userId:            string,
    leaveId:           string,
    action:            "APPROVED" | "REJECTED",
    rejection_reason?: string,
  ) {
    const businessIds = await this.getBusinessIds(userId);
    const leave       = await BusinessStaffRepository.findLeave(leaveId, businessIds);
    if (!leave) throw new NotFoundError("Leave request not found.");

    if (leave.status !== "PENDING") {
      throw new BadRequestError("This leave request has already been processed.");
    }

    if (action === "APPROVED") {
      const conflictCount = await prisma.booking.count({
        where: {
          staff_id:     leave.staff_id,
          service_date: { gte: leave.start_date, lte: leave.end_date },
          status:       { in: ["CONFIRMED"] },
        },
      });
      if (conflictCount > 0) {
        throw new BadRequestError(
          `Cannot approve: ${conflictCount} confirmed booking(s) exist during the leave period. ` +
          "Please cancel or reassign them first."
        );
      }
    }

    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true },
    });

    await BusinessStaffRepository.processLeave(leaveId, action, owner?.id ?? userId, rejection_reason);

    const notifExpiresAt = add(new Date(), { days: 30 });
    await prisma.staffNotification.create({
      data: {
        staff_id:   leave.staff_id,
        type:       action === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        title:      action === "APPROVED" ? "Leave Approved ✅" : "Leave Rejected",
        message:    action === "APPROVED"
          ? `Your leave from ${toISTDate(leave.start_date)} to ${toISTDate(leave.end_date)} was approved.`
          : `Your leave was rejected. Reason: ${rejection_reason ?? "No reason provided."}`,
        expires_at: notifExpiresAt,
      },
    });

    const staffBusiness = await prisma.staff.findUnique({
      where:  { id: leave.staff_id },
      select: { business_id: true },
    });
    if (staffBusiness?.business_id) {
      await prisma.businessNotification.create({
        data: {
          business_id: staffBusiness.business_id,
          type:        action === "APPROVED" ? "STAFF_LEAVE_APPROVED" : "STAFF_LEAVE_REJECTED",
          title:       action === "APPROVED" ? "Staff Leave Approved" : "Staff Leave Rejected",
          message:     action === "APPROVED"
            ? `${leave.staff.name}'s leave (${toISTDate(leave.start_date)} – ${toISTDate(leave.end_date)}) has been approved.`
            : `${leave.staff.name}'s leave was rejected.`,
          target:      "SALOON_PC",
          expires_at:  notifExpiresAt,
        },
      }).catch(() => {});
    }

    if (leave.staff.user?.id) {
      const evtName = action === "APPROVED" ? "staff:leave_approved" : "staff:leave_rejected";
      emitToUser(leave.staff.user.id, evtName, { leaveId, action, rejection_reason });
    }

    queueEmail({
      to:   leave.staff.email,
      type: action === "APPROVED" ? "leave-approved-staff" : "leave-rejected-staff",
      data: {
        staffName:        leave.staff.name,
        ownerName:        owner?.name ?? "",
        startDate:        toISTDate(leave.start_date),
        endDate:          toISTDate(leave.end_date),
        leaveType:        leave.leave_type,
        action,
        rejectionReason:  rejection_reason ?? null,
      },
    }).catch(err => logger.warn("[BusinessStaff] Leave email failed:", err));

    return { leave_id: leaveId, status: action };
  }

  private static async sendInvitation(
    userId:     string,
    email:      string,
    name:       string,
    businessId: string,
  ) {
    const rawToken    = generateToken();
    const hashedToken = hashToken(rawToken);

    await prisma.emailVerificationToken.create({
      data: {
        user_id:    userId,
        token:      hashedToken,
        expires_at: add(new Date(), { hours: 48 }),
      },
    });

    const setupUrl = `${process.env.CLIENT_URL}/staff/setup?token=${rawToken}`;
    const business = await prisma.business.findUnique({
      where:  { id: businessId },
      select: { business_name: true, owner: { select: { name: true } } },
    });

    queueEmail({
      to:   email,
      type: "staff-invitation",
      data: {
        staffName:    name,
        staffEmail:   email,
        businessName: business?.business_name ?? "Your employer",
        ownerName:    (business as any)?.owner?.name ?? "The Owner",
        setupUrl,
        expiresIn:    "48 hours",
      },
    }).catch(err => logger.warn("[BusinessStaff] Invitation email failed:", err));
  }

  static async getSetupPendingStaff(
    userId:      string,
    businessId?: string,
  ) {
    const businessIds = await this.getBusinessIds(userId);
    const scopedIds   = businessId
      ? businessIds.filter(id => id === businessId)
      : businessIds;

    if (scopedIds.length === 0) return [];

    const staff = await prisma.staff.findMany({
      where: { business_id: { in: scopedIds } },
      include: {
        user:     { select: { id: true, password_hash: true } },
        business: { select: { id: true, business_name: true } },
      },
      orderBy: { created_at: "desc" },
    });

    return staff.map(s => ({
      id:              s.id,
      name:            s.name,
      email:           s.email,
      business_id:     s.business.id,
      business_name:   s.business.business_name,
      setup_complete:  !!s.user?.password_hash,
      is_active:       s.is_active,
      avatar_url:      s.avatar_url ?? null,
    }));
  }

}