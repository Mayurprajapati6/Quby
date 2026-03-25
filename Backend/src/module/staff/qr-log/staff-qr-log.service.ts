import { prisma } from "../../../config/prisma";
import { StaffQrLogRepository }  from "./staff-qr-log.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

async function resolveStaff(userId: string) {
  const s = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, is_active: true },
  });
  if (!s) throw new NotFoundError("Staff profile not found.");
  if (!s.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return s;
}

export class StaffQrLogService {

  static async getQrLog(userId: string, opts: { date?: string; page: number; limit: number }) {
    const staff = await resolveStaff(userId);
    const { records, total } = await StaffQrLogRepository.find(staff.id, {
      date:  opts.date,
      skip:  (opts.page - 1) * opts.limit,
      take:  opts.limit,
    });

    return {
      scans: records.map(r => ({
        qr_code_id:     r.qr_code_id,
        used_at:        r.used_at ? toIST(r.used_at) : null,
        booking: {
          id:             r.booking.id,
          booking_number: r.booking.booking_number,
          service_date:   toISTDate(r.booking.service_date),
          services:       Array.isArray(r.booking.services)
            ? r.booking.services.map((s: any) => s.name ?? "") : [],
          customer: {
            id:         r.booking.customer.id,
            name:       r.booking.customer.name,
            avatar_url: r.booking.customer.avatar_url ?? null,
          },
        },
      })),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }
}
