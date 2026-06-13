import { BusinessStaffRepository } from "./business-staff.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import type {
  BusinessStaffListItemDTO,
  BusinessStaffDetailDTO,
  StaffLeaveDTO,
  StaffAttendanceDTO,
} from "./business-staff.types";

const IST = "Asia/Kolkata";
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }

export class BusinessStaffService {

  private static assertBusiness(staff: any, businessId: string) {
    if (!staff || staff.business_id !== businessId) {
      throw new NotFoundError("Staff member not found in this business.");
    }
  }

  static async getStaffList(businessId: string): Promise<BusinessStaffListItemDTO[]> {
    const staff = await BusinessStaffRepository.findAll(businessId);
    return staff.map(s => ({
      id:               s.id,
      name:             s.name,
      email:            s.email,
      phone:            s.phone          ?? null,
      avatar_url:       s.avatar_url     ?? null,
      specialization:   s.specialization ?? null,
      experience_years: s.experience_years ?? null,
      is_active:        s.is_active,
      setup_complete:   !!(s as any).setup_complete,
      average_rating:   s.average_rating  ?? 0,
      total_reviews:    s.total_reviews   ?? 0,
      today_bookings:   (s as any)._count?.bookings ?? 0,
    }));
  }

  static async getStaffDetail(staffId: string, businessId: string): Promise<BusinessStaffDetailDTO> {
    const [staff, stats] = await Promise.all([
      BusinessStaffRepository.findById(staffId, businessId),
      BusinessStaffRepository.getMonthStats(staffId),
    ]);
    if (!staff) throw new NotFoundError("Staff member not found.");
    this.assertBusiness(staff, businessId);

    return {
      id:               staff.id,
      name:             staff.name,
      email:            staff.email,
      phone:            staff.phone          ?? null,
      avatar_url:       staff.avatar_url     ?? null,
      specialization:   staff.specialization ?? null,
      experience_years: staff.experience_years ?? null,
      is_active:        staff.is_active,
      setup_complete:   !!(staff as any).setup_complete,
      average_rating:   staff.average_rating  ?? 0,
      total_reviews:    staff.total_reviews   ?? 0,
      today_bookings:   (staff as any)._count?.bookings ?? 0,
      bio:              staff.bio             ?? null,
      join_date:        toISTDate(staff.created_at),
      services: staff.services.map((sv: any) => ({
        id:               sv.service_offering.id,
        name:             sv.service_offering.platform_service.name,
        category:         sv.service_offering.platform_service.category ?? null,
        duration_minutes: sv.duration_minutes,
        is_available:     sv.is_available,
      })),
      schedule: staff.schedules.map((sc: any) => ({
        day_of_week:  sc.day_of_week,
        is_available: sc.is_available,
        start_time:   sc.start_time ?? null,
        end_time:     sc.end_time   ?? null,
      })),
      stats,
    };
  }

  static async updateStaffSchedule(
    staffId:    string,
    businessId: string,
    schedules:  Array<{
      day_of_week:  string;
      is_available: boolean;
      start_time?:  string;
      end_time?:    string;
    }>,
  ) {
    const staff = await BusinessStaffRepository.findById(staffId, businessId);
    if (!staff) throw new NotFoundError("Staff member not found.");
    await BusinessStaffRepository.upsertSchedule(staffId, schedules);
    return { updated: schedules.length };
  }

  static async getStaffLeaves(
    staffId:    string,
    businessId: string,
    status?:    string,
  ): Promise<StaffLeaveDTO[]> {
    const staff = await BusinessStaffRepository.findById(staffId, businessId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    const leaves = await BusinessStaffRepository.findLeaves(staffId, businessId, status);
    return leaves.map(l => ({
      id:               l.id,
      leave_type:       l.leave_type,
      start_date:       toISTDate(l.start_date),
      end_date:         toISTDate(l.end_date),
      reason:           l.reason,
      status:           l.status,
      rejection_reason: l.rejection_reason ?? null,
      created_at:       toISTDate(l.created_at),
    }));
  }

  static async getStaffAttendance(
    staffId:    string,
    businessId: string,
    month?:     string,   // YYYY-MM
  ): Promise<StaffAttendanceDTO[]> {
    const staff = await BusinessStaffRepository.findById(staffId, businessId);
    if (!staff) throw new NotFoundError("Staff member not found.");

    const monthDate = month ? new Date(`${month}-01T00:00:00+05:30`) : new Date();
    const records   = await BusinessStaffRepository.findAttendance(staffId, businessId, monthDate);

    return records.map(r => ({
      id:            r.id,
      date:          toISTDate(r.date),
      status:        r.status,
      check_in_time: r.check_in_time ? toIST(r.check_in_time) : null,
      source:        r.source,
    }));
  }
}
