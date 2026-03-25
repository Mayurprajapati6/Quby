import { StaffLeaveRepository }  from "./staff-leave.repository";
import { prisma } from "../../../config/prisma";
import { emitToUser } from "../../../socket/socket.service";
import { queueEmail } from "../../../services/email.services";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
} from "../../../utils/errors/app.error";
import logger from "../../../config/logger.config";
import type { RequestLeaveDTO, StaffLeaveItemDTO } from "./staff-leave.types";

export class StaffLeaveService {

  private static async resolveStaff(userId: string) {
    const staff = await StaffLeaveRepository.findStaffByUserId(userId);
    if (!staff)          throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
    return staff;
  }

  static async getLeaveRequests(userId: string): Promise<StaffLeaveItemDTO[]> {
    const staff  = await this.resolveStaff(userId);
    const leaves = await StaffLeaveRepository.findAll(staff.id);
    return leaves.map(toDTO);
  }

  static async requestLeave(userId: string, dto: RequestLeaveDTO): Promise<StaffLeaveItemDTO> {
    const staff = await this.resolveStaff(userId);

    const startDate = new Date(dto.start_date);
    const endDate   = new Date(dto.end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestError("Invalid date format. Use YYYY-MM-DD.");
    }
    if (endDate < startDate) {
      throw new BadRequestError("end_date must be on or after start_date.");
    }
    if (startDate <= new Date()) {
      throw new BadRequestError("Leave dates must be in the future.");
    }

    const overlap = await StaffLeaveRepository.findOverlapping(staff.id, startDate, endDate);
    if (overlap) {
      throw new ConflictError("You already have a leave request overlapping these dates.");
    }

    const leave = await StaffLeaveRepository.create({
      staffId:   staff.id,
      leaveType: dto.leave_type,
      startDate,
      endDate,
      reason:    dto.reason,
    });

    const owner = staff.business?.owner;
    if (owner) {
      emitToUser(owner.user.id, "staff:leave_requested", {
        staffId:   staff.id,
        staffName: staff.name,
        leaveId:   leave.id,
        startDate: dto.start_date,
        endDate:   dto.end_date,
      });

      await prisma.businessNotification.create({
        data: {
          business_id: staff.business_id,
          type:        "STAFF_LEAVE_REQUEST",
          title:       `Leave Request — ${staff.name}`,
          message:     `${staff.name} requested ${dto.leave_type} leave from ${dto.start_date} to ${dto.end_date}.` +
                       (dto.reason ? ` Reason: ${dto.reason}` : ""),
          target:      "BOTH",
          expires_at:  new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      }).catch((err) => logger.warn("[StaffLeave] Owner in-app notification failed:", err));

      queueEmail({
        to:   owner.user.email,
        type: "leave-request-owner",
        data: {
          staffName:    staff.name,
          ownerName:    (owner as any).name ?? "",
          businessName: staff.business!.business_name,
          startDate:    dto.start_date,
          endDate:      dto.end_date,
          leaveType:    dto.leave_type,
          reason:       dto.reason,
          approveUrl:   `${process.env.CLIENT_URL}/owner/staff/leave/${leave.id}?action=approve`,
          rejectUrl:    `${process.env.CLIENT_URL}/owner/staff/leave/${leave.id}?action=reject`,
        },
      }).catch((err) => logger.warn("[StaffLeave] Owner notification email failed:", err));
    }

    return toDTO(leave);
  }

  static async cancelLeave(userId: string, leaveId: string): Promise<void> {
    const staff = await this.resolveStaff(userId);

    const leave = await StaffLeaveRepository.findOne(leaveId, staff.id);
    if (!leave) throw new NotFoundError("Leave request not found.");

    if (leave.status !== "PENDING") {
      throw new BadRequestError(
        `Only PENDING leave requests can be cancelled. This request is ${leave.status}.`
      );
    }

    await StaffLeaveRepository.deletePending(leaveId);
  }
}

function toDTO(l: any): StaffLeaveItemDTO {
  return {
    id:               l.id,
    leave_type:       l.leave_type,
    start_date:       l.start_date,
    end_date:         l.end_date,
    reason:           l.reason,
    status:           l.status,
    approved_by:      l.approved_by      ?? null,
    approved_at:      l.approved_at      ?? null,
    rejection_reason: l.rejection_reason ?? null,
    created_at:       l.created_at,
  };
}