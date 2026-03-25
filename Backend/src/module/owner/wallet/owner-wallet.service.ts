import { OwnerWalletRepository }   from "./owner-wallet.repository";
import { NotFoundError }           from "../../../utils/errors/app.error";
import type {
  OwnerWalletSummaryDTO,
  BusinessWalletCardDTO,
  EscrowListResponseDTO,
  EscrowTransactionDTO,
} from "./owner-wallet.types";

export class OwnerWalletService {

  static async getSummary(userId: string): Promise<OwnerWalletSummaryDTO> {
    const owner = await OwnerWalletRepository.findOwner(userId);
    if (!owner) throw new NotFoundError("Owner not found.");

    const businesses = await OwnerWalletRepository.findBusinessesWithWallets(owner.id);
    const businessIds = businesses.map((b) => b.id);

    const escrowGroups = await OwnerWalletRepository.findEscrowHeldByBusiness(businessIds);
    const escrowMap   = new Map(
      escrowGroups.map((g) => [g.business_id, g._sum.amount ?? 0])
    );

    let totalBalance     = 0;
    let totalEscrowHeld  = 0;

    const cards: BusinessWalletCardDTO[] = businesses.map((b) => {
      const balance      = b.wallet?.balance         ?? 0;
      const earned       = b.wallet?.lifetime_earnings  ?? 0;
      const escrowHeld   = escrowMap.get(b.id)        ?? 0;

      totalBalance    += balance;
      totalEscrowHeld += escrowHeld;

      return {
        business_id:     b.id,
        business_name:   b.business_name,
        logo_url:        b.logo_url,
        balance,
        escrow_held:     escrowHeld,
        lifetime_earned: earned,
      };
    });

    return {
      total_balance:     totalBalance,
      total_escrow_held: totalEscrowHeld,
      lifetime_earnings: owner.lifetime_earnings,
      businesses:        cards,
    };
  }

  static async getEscrowHistory(
    userId: string,
    filters: {
      businessId?: string;
      status?:     string;
      fromDate?:   string;
      toDate?:     string;
      page?:       number;
      limit?:      number;
    }
  ): Promise<EscrowListResponseDTO> {
    const owner = await OwnerWalletRepository.findOwner(userId);
    if (!owner) throw new NotFoundError("Owner not found.");

    const businesses = await OwnerWalletRepository.findBusinessesWithWallets(owner.id);
    const businessIds = businesses.map((b) => b.id);

    const page  = filters.page  ?? 1;
    const limit = filters.limit ?? 20;
    const skip  = (page - 1) * limit;

    const { transactions, total } = await OwnerWalletRepository.findEscrowHistory(
      businessIds,
      {
        businessId: filters.businessId,
        status:     filters.status,
        fromDate:   filters.fromDate ? new Date(filters.fromDate) : undefined,
        toDate:     filters.toDate   ? new Date(filters.toDate)   : undefined,
        skip,
        take: limit,
      }
    );

    const mapped: EscrowTransactionDTO[] = transactions.map((t: any) => ({
      id:                   t.id,
      booking_id:           t.booking_id,
      booking_number:       t.booking.booking_number,
      business_id:          t.business_id,
      business_name:        t.booking.business.business_name,
      amount:               t.amount,
      net_amount:           t.net_amount,
      platform_fee:         t.platform_fee,
      status:               t.status,
      scheduled_release_at: t.scheduled_release_at,
      released_at:          t.released_at ?? null,
      customer_name:        t.booking.customer.name,
      staff_name:           t.booking.staff.name,
      services:             Array.isArray(t.booking.services) ? (t.booking.services as any[]).map((s: any) => s.name ?? "") : [],
    }));

    return {
      transactions: mapped,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
