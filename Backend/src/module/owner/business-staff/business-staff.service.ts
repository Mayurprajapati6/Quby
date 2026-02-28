import { BusinessStaffRepository } from "./business-staff.repository";
import { BusinessRepository } from "../business/business.repository";
import { queueEmail } from "../../../services/email.services";
import { socketService } from "../../../socket/socket.service";
import { redisClient } from "../../../config/redis";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "../../../utils/errors/app.error";
import { BUSINESS_MESSAGES, STAFF_MESSAGES } from "../../../constants/messages";
import logger from "../../../config/logger.config";
import { prisma } from "../../../config/prisma";

async function invalidateStaffCache(staffId: string) {
  try { await redisClient.del(`cache:staff:${staffId}:profile`); }
  catch (err) { logger.warn("[OwnerStaff] Cache invalidation failed:", err); }
}

export class BusinessStaffService {

  private static async verifyBusiness(businessId: string, ownerId: string) {
    const business = await BusinessRepository.findByOwnerAndId(businessId, ownerId);
    if (!business) throw new NotFoundError(BUSINESS_MESSAGES.NOT_FOUND);
    return business;
  }

  static async listStaff(businessId: string, ownerId: string) {
    await this.verifyBusiness(businessId, ownerId);
    return BusinessStaffRepository.findAllInBusiness(businessId);
  }

  static async getStaff(businessId: string, staffId: string, ownerId: string) {
    await this.verifyBusiness(businessId, ownerId);
    const staff = await BusinessStaffRepository.findStaffInBusiness(staffId, businessId);
    if (!staff) throw new NotFoundError(STAFF_MESSAGES.NOT_FOUND);
    return staff;
  }

  static async createStaff(businessId: string, ownerId: string, data: {
    name:             string;
    email:            string;
    phone:            string;
    specialization?:  string;
    experience_years?: number;
    bio?:             string;
    services: Array<{ service_offering_id: string; duration_minutes: number }>;
    schedule?: Array<{ day_of_week: string; is_available: boolean; start_time?: string; end_time?: string }>;
  }) {
    const business = await this.verifyBusiness(businessId, ownerId);

    const existingUser = await BusinessStaffRepository.findByEmail(data.email);
    if (existingUser) throw new ConflictError(STAFF_MESSAGES.EMAIL_EXISTS);

    const owner = await prisma.owner.findUnique({
      where:   { id: ownerId },
      select:  { name: true },
    });

    const { staff, user, rawToken } = await BusinessStaffRepository.createWithTransaction({
      businessId,
      ownerId,
      ...data,
    });

    const setupUrl = `${process.env.CLIENT_URL}/auth/staff-setup?token=${rawToken}`;

    queueEmail({
      to:   data.email,
      type: "staff-invitation",
      data: {
        staffName:       data.name,
        businessName:    business.business_name,
        businessType:    business.business_type,
        ownerName:       owner?.name ?? "The owner",
        specialization:  data.specialization ?? "General",
        experienceYears: data.experience_years ?? 0,
        role:            "Staff",
        setupUrl,
      },
    }).catch((err) =>
      logger.warn(`[OwnerStaff] Invitation email queue failed for ${data.email} (non-fatal):`, err)
    );

    return staff;
  }

  static async updateStaff(businessId: string, staffId: string, ownerId: string, data: {
    name?:            string;
    phone?:           string;
    specialization?:  string;
    experience_years?: number;
    bio?:             string;
  }) {
    await this.verifyBusiness(businessId, ownerId);
    const staff = await BusinessStaffRepository.findStaffInBusiness(staffId, businessId);
    if (!staff) throw new NotFoundError(STAFF_MESSAGES.NOT_FOUND);

    const updated = await BusinessStaffRepository.updateStaff(staffId, data);
    await invalidateStaffCache(staffId);
    return updated;
  }

  static async deactivateStaff(businessId: string, staffId: string, ownerId: string) {
    await this.verifyBusiness(businessId, ownerId);
    const staff = await BusinessStaffRepository.findStaffInBusiness(staffId, businessId);
    if (!staff) throw new NotFoundError(STAFF_MESSAGES.NOT_FOUND);

    const futureBookings = await BusinessStaffRepository.countFutureBookings(staffId);
    if (futureBookings > 0) throw new BadRequestError(STAFF_MESSAGES.HAS_FUTURE_BOOKINGS);

    await BusinessStaffRepository.updateStaff(staffId, { is_active: false });

    await prisma.user.update({ where: { id: staff.user.id }, data: { is_active: false } });

    await invalidateStaffCache(staffId);
  }

  static async updateServices(businessId: string, staffId: string, ownerId: string, services: Array<{
    service_offering_id: string;
    duration_minutes:    number;
    is_available?:       boolean;
  }>) {
    await this.verifyBusiness(businessId, ownerId);
    const staff = await BusinessStaffRepository.findStaffInBusiness(staffId, businessId);
    if (!staff) throw new NotFoundError(STAFF_MESSAGES.NOT_FOUND);

    await BusinessStaffRepository.updateServices(staffId, services);
    await invalidateStaffCache(staffId);
  }

  static async updateSchedule(businessId: string, staffId: string, ownerId: string, schedule: Array<{
    day_of_week:  string;
    is_available: boolean;
    start_time?:  string;
    end_time?:    string;
  }>) {
    await this.verifyBusiness(businessId, ownerId);
    const staff = await BusinessStaffRepository.findStaffInBusiness(staffId, businessId);
    if (!staff) throw new NotFoundError(STAFF_MESSAGES.NOT_FOUND);

    await BusinessStaffRepository.updateSchedule(staffId, schedule);
    await invalidateStaffCache(staffId);
  }

  static async getPendingLeaves(businessId: string, ownerId: string) {
    await this.verifyBusiness(businessId, ownerId);
    return BusinessStaffRepository.getPendingLeaves(businessId);
  }

  static async processLeave(
    businessId: string,
    leaveId:    string,
    ownerId:    string,
    data:       { action: "APPROVED" | "REJECTED"; rejection_reason?: string }
  ) {
    const business = await this.verifyBusiness(businessId, ownerId);
    const leave = await BusinessStaffRepository.findLeave(leaveId, businessId);
    if (!leave) throw new NotFoundError(STAFF_MESSAGES.LEAVE_NOT_FOUND);
    if (leave.status !== "PENDING") throw new BadRequestError(STAFF_MESSAGES.LEAVE_NOT_PENDING);

    if (data.action === "APPROVED") {
      const conflicts = await BusinessStaffRepository.countBookingsForStaffInRange(
        leave.staff_id,
        leave.start_date,
        leave.end_date
      );
      if (conflicts > 0) {
        throw new BadRequestError(
          `${STAFF_MESSAGES.LEAVE_CONFLICT_BOOKINGS} (${conflicts} booking${conflicts > 1 ? "s" : ""} conflict)`
        );
      }
    }

    const updated = await BusinessStaffRepository.processLeave(leaveId, {
      status:           data.action,
      approvedBy:       ownerId,
      rejection_reason: data.rejection_reason,
    });

    const staffUserId = leave.staff.user.id;
    const emailType   = data.action === "APPROVED" ? "leave-approved-staff" : "leave-rejected-staff";

    if (data.action === "APPROVED") {
      socketService.notifyLeaveApproved(staffUserId, {
        leaveId,
        startDate: leave.start_date.toISOString(),
        endDate:   leave.end_date.toISOString(),
        message:   "Your leave request has been approved.",
      });
    } else {
      socketService.notifyLeaveRejected(staffUserId, {
        leaveId,
        startDate: leave.start_date.toISOString(),
        endDate:   leave.end_date.toISOString(),
        reason:    data.rejection_reason ?? "No reason provided.",
      });
    }

    queueEmail({
      to:   leave.staff.email,
      type: emailType,
      data: {
        staffName:        leave.staff.name,
        businessName:     business.business_name,
        startDate:        leave.start_date.toISOString(),
        endDate:          leave.end_date.toISOString(),
        rejectionReason:  data.rejection_reason,
      },
    }).catch((err) => logger.warn("[OwnerStaff] Leave email failed (non-fatal):", err));

    return updated;
  }
}