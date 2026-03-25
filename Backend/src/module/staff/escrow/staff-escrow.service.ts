import { prisma } from "../../../config/prisma";
import { StaffEscrowRepository } from "./staff-escrow.repository";
import { NotFoundError, ForbiddenError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date)     { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

async function resolveStaff(userId: string) {
  const s = await prisma.staff.findUnique({
    where:  { user_id: userId },
    select: { id: true, is_active: true },
  });
  if (!s)           throw new NotFoundError("Staff profile not found.");
  if (!s.is_active) throw new ForbiddenError("Your account has been deactivated.");
  return s;
}

function toEscrowItem(e: any) {
  return {
    id:                   e.id,
    status:               e.status,
    amount_inr:           e.amount / 100,
    held_at:              toIST(e.held_at),
    scheduled_release_at: toIST(e.scheduled_release_at),
    released_at:          e.released_at ? toIST(e.released_at) : null,
    refunded_at:          e.refunded_at ? toIST(e.refunded_at) : null,
    booking: {
      id:             e.booking.id,
      booking_number: e.booking.booking_number,
      service_date:   toISTDate(e.booking.service_date),
      services:       Array.isArray(e.booking.services)
        ? e.booking.services.map((s: any) => s.name ?? "") : [],
      customer_name:  e.booking.customer.name,
    },
  };
}

export class StaffEscrowService {

  static async getEscrows(userId: string, opts: { status?: string; from?: string; to?: string; page: number; limit: number }) {
    const staff = await resolveStaff(userId);

    const [{ escrows, total }, summary] = await Promise.all([
      StaffEscrowRepository.find(staff.id, {
        status: opts.status,
        from:   opts.from,
        to:     opts.to,
        skip:   (opts.page - 1) * opts.limit,
        take:   opts.limit,
      }),
      StaffEscrowRepository.getSummary(staff.id),
    ]);

    return {
      summary: {
        held:     { count: summary.held._count.id,     amount_inr: (summary.held._sum.amount     ?? 0) / 100 },
        released: { count: summary.released._count.id, amount_inr: (summary.released._sum.amount ?? 0) / 100 },
        refunded: { count: summary.refunded._count.id, amount_inr: (summary.refunded._sum.amount ?? 0) / 100 },
      },
      escrows: escrows.map(toEscrowItem),
      pagination: { total, page: opts.page, limit: opts.limit, total_pages: Math.ceil(total / opts.limit) },
    };
  }
}
