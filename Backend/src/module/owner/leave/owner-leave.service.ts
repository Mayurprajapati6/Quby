import { prisma } from "../../../config/prisma";
import { OwnerLeaveRepository } from "./owner-leave.repository";
import { emitToUser } from "../../../socket/socket.service";
import { queueEmail, sendEmail } from "../../../services/email.services";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import { formatInTimeZone } from "date-fns-tz";
import { add } from "date-fns";
import type {
  LeaveListItemDTO,
  ProcessLeaveDTO,
} from "./owner-leave.types";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }

export class OwnerLeaveService {

  private static async getBusinessIds(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true, name: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return { ownerId: owner.id, ownerName: owner.name, businessIds: businesses.map(b => b.id) };
  }

  private static toDTO(l: any): LeaveListItemDTO {
    return {
      id:               l.id,
      staff_id:         l.staff_id,
      staff_name:       l.staff.name,
      staff_avatar:     l.staff.avatar_url ?? null,
      business_id:      l.staff.business.id,
      business_logo:    l.staff.business.logo_url ?? null,
      business_name:    l.staff.business.business_name,
      leave_type:       l.leave_type,
      start_date:       toISTDate(l.start_date),
      end_date:         toISTDate(l.end_date),
      reason:           l.reason,
      status:           l.status,
      rejection_reason: l.rejection_reason ?? null,
      approved_at:      l.approved_at ? toIST(l.approved_at) : null,
      created_at:       toISTDate(l.created_at),
    };
  }

  static async getLeaveRequests(
    userId:  string,
    filters: { status?: string; business_id?: string },
  ): Promise<LeaveListItemDTO[]> {
    const { businessIds } = await this.getBusinessIds(userId);

    if (filters.business_id && !businessIds.includes(filters.business_id)) {
      throw new ForbiddenError("Business not found.");
    }

    const leaves = await OwnerLeaveRepository.findAll(businessIds, filters);
    return leaves.map(this.toDTO);
  }

  static async processLeave(
    userId:   string,
    leaveId:  string,
    dto:      ProcessLeaveDTO,
  ): Promise<LeaveListItemDTO> {
    const { ownerId, ownerName, businessIds } = await this.getBusinessIds(userId);

    const leave = await OwnerLeaveRepository.findOne(leaveId, businessIds);
    if (!leave) throw new NotFoundError("Leave request not found.");

    if (leave.status !== "PENDING") {
      throw new BadRequestError(`Leave request is already ${leave.status}.`);
    }

    if (dto.action === "REJECTED" && !dto.rejection_reason?.trim()) {
      throw new BadRequestError("rejection_reason is required when rejecting a leave.");
    }

    if (dto.action === "APPROVED") {
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

    const updated = await OwnerLeaveRepository.process(
      leaveId, ownerId, dto.action, dto.rejection_reason,
    );

    const notifExpiresAt = add(new Date(), { days: 30 });
    await prisma.staffNotification.create({
      data: {
        staff_id:   leave.staff_id,
        type:       dto.action === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
        title:      dto.action === "APPROVED" ? "Leave Approved ✅" : "Leave Rejected",
        message:    dto.action === "APPROVED"
          ? `Your leave from ${toISTDate(leave.start_date)} to ${toISTDate(leave.end_date)} was approved.`
          : `Your leave was rejected. Reason: ${dto.rejection_reason ?? "No reason provided."}`,
        expires_at: notifExpiresAt,
      },
    }).catch(() => {});

    if (leave.staff.business?.id) {
      await prisma.businessNotification.create({
        data: {
          business_id: leave.staff.business.id,
          type:        dto.action === "APPROVED" ? "STAFF_LEAVE_APPROVED" : "STAFF_LEAVE_REJECTED",
          title:       dto.action === "APPROVED" ? "Staff Leave Approved" : "Staff Leave Rejected",
          message:     dto.action === "APPROVED"
            ? `${leave.staff.name}'s leave (${toISTDate(leave.start_date)} – ${toISTDate(leave.end_date)}) was approved.`
            : `${leave.staff.name}'s leave was rejected.`,
          target:      "SALOON_PC",
          expires_at:  notifExpiresAt,
        },
      }).catch(() => {});
    }

    if (leave.staff.user?.id) {
      
      const leaveEvent = dto.action === "APPROVED" ? "staff:leave_approved" : "staff:leave_rejected";
      emitToUser(leave.staff.user.id, leaveEvent, {
        leaveId,
        action:           dto.action,
        rejection_reason: dto.rejection_reason ?? null,
      });
    }

    // Send immediately (not queued) — critical notification staff must receive ASAP
    sendEmail(
      leave.staff.email,
      dto.action === "APPROVED" ? "leave-approved-staff" : "leave-rejected-staff",
      {
        staffName:        leave.staff.name,
        ownerName:        ownerName,
        startDate:        toISTDate(leave.start_date),
        endDate:          toISTDate(leave.end_date),
        leaveType:        leave.leave_type,
        action:           dto.action,
        rejectionReason:  dto.rejection_reason ?? null,
      },
    ).catch(err => logger.warn("[OwnerLeave] Leave email failed:", err));

    return this.toDTO({ ...updated, staff: leave.staff });
  }
}
