import { prisma } from "../../../config/prisma";
import { StaffOperationRepository } from "./staff-operation.repository";
import {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
} from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }

function parseISTDate(str: string) {
  return new Date(`${str}T00:00:00+05:30`);
}

function toLeaveDTO(l: any) {
  return {
    id:               l.id,
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

export class StaffOperationService {

  private static async resolveStaff(userId: string) {
    const staff = await prisma.staff.findUnique({
      where:  { user_id: userId },
      select: { id: true, is_active: true },
    });
    if (!staff)           throw new NotFoundError("Staff profile not found.");
    if (!staff.is_active) throw new ForbiddenError("Your account has been deactivated.");
    return staff;
  }

  static async getLeaves(userId: string, status?: string) {
    const staff  = await this.resolveStaff(userId);
    const leaves = await StaffOperationRepository.findLeaves(staff.id, status);
    return leaves.map(toLeaveDTO);
  }

  static async requestLeave(
    userId: string,
    data: {
      leave_type: string;
      start_date: string;
      end_date:   string;
      reason:     string;
    },
  ) {
    const staff     = await this.resolveStaff(userId);
    const startDate = parseISTDate(data.start_date);
    const endDate   = parseISTDate(data.end_date);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new BadRequestError("Invalid date format. Use YYYY-MM-DD.");
    }
    if (startDate < new Date()) {
      throw new BadRequestError("start_date must be in the future.");
    }
    if (endDate < startDate) {
      throw new BadRequestError("end_date must be on or after start_date.");
    }

    const overlap = await StaffOperationRepository.findOverlappingLeave(
      staff.id, startDate, endDate,
    );
    if (overlap) {
      throw new BadRequestError("You already have a leave request overlapping this period.");
    }

    const leave = await StaffOperationRepository.createLeave({
      staffId:   staff.id,
      leaveType: data.leave_type,
      startDate,
      endDate,
      reason:    data.reason,
    });

    return toLeaveDTO(leave);
  }

  static async cancelLeave(userId: string, leaveId: string) {
    const staff = await this.resolveStaff(userId);
    const leave = await StaffOperationRepository.findLeaveById(leaveId, staff.id);
    if (!leave) throw new NotFoundError("Leave request not found.");

    if (leave.status !== "PENDING") {
      throw new BadRequestError("Only PENDING leave requests can be cancelled.");
    }

    await StaffOperationRepository.deleteLeave(leaveId);
    return { message: "Leave request cancelled." };
  }
}
