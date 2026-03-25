import { prisma } from "../../../config/prisma";
import { OwnerEscrowRepository } from "./owner-escrow.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";

const IST = "Asia/Kolkata";
function toIST(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd'T'HH:mm:ssxxx"); }
function toISTDate(d: Date) { return formatInTimeZone(d, IST, "yyyy-MM-dd"); }

export class OwnerEscrowService {

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

  static async getEscrows(
    userId: string,
    opts: {
      business_id?: string;
      status?:      string;
      from?:        string;
      to?:          string;
      page:         number;
      limit:        number;
    },
  ) {
    const businessIds = await this.getBusinessIds(userId);
    const { rows, total } = await OwnerEscrowRepository.find({ businessIds, ...opts });
    const summary = await OwnerEscrowRepository.getSummary(businessIds);

    return {
      escrows: rows.map(e => ({
        id:                   e.id,
        booking_number:       e.booking.booking_number,
        business_name:        e.booking.business.business_name,
        customer_name:        e.booking.customer.name,
        staff_name:           e.booking.staff.name,
        service_date:         toISTDate(e.booking.service_date),
        service_start_time:       toIST(e.booking.service_start_time),
        amount_inr:           e.amount / 100,
        status:               e.status,
        held_at:              toIST(e.held_at),
        scheduled_release_at: toIST(e.scheduled_release_at),
        released_at:          e.released_at  ? toIST(e.released_at)  : null,
        refunded_at:          e.refunded_at  ? toIST(e.refunded_at)  : null,
      })),
      summary: {
        held_amount_inr:     (summary.held._sum.amount     ?? 0) / 100,
        held_count:           summary.held._count.id,
        released_amount_inr: (summary.released._sum.amount ?? 0) / 100,
        released_count:       summary.released._count.id,
        refunded_amount_inr: (summary.refunded._sum.amount ?? 0) / 100,
        refunded_count:       summary.refunded._count.id,
      },
      pagination: {
        total,
        page:        opts.page,
        limit:       opts.limit,
        total_pages: Math.ceil(total / opts.limit),
      },
    };
  }

  static async getEscrowDetail(userId: string, escrowId: string) {
    const businessIds = await this.getBusinessIds(userId);
    const escrow      = await OwnerEscrowRepository.findById(escrowId, businessIds);
    if (!escrow) throw new NotFoundError("Escrow transaction not found.");

    return {
      id:                   escrow.id,
      transaction_id:       escrow.transaction_id,
      booking_number:       escrow.booking.booking_number,
      business_name:        escrow.booking.business.business_name,
      customer_name:        escrow.booking.customer.name,
      customer_phone:       escrow.booking.customer.phone ?? null,
      staff_name:           escrow.booking.staff.name,
      service_date:         toISTDate(escrow.booking.service_date),
      service_start_time:       toIST(escrow.booking.service_start_time),
      service_amount_inr:   (escrow.booking as any).service_amount         / 100,
      platform_fee_inr:     ((escrow.booking as any).platform_fee  ?? 0) / 100,
      escrow_amount_inr:    escrow.amount / 100,
      status:               escrow.status,
      held_at:              toIST(escrow.held_at),
      scheduled_release_at: toIST(escrow.scheduled_release_at),
      released_at:          escrow.released_at ? toIST(escrow.released_at) : null,
      refunded_at:          escrow.refunded_at ? toIST(escrow.refunded_at) : null,
    };
  }
}
