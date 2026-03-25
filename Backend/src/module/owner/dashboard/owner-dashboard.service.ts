import { prisma } from "../../../config/prisma";
import { OwnerDashboardRepository as Repo } from "./owner-dashboard.repository";
import { NotFoundError } from "../../../utils/errors/app.error";
import { formatInTimeZone } from "date-fns-tz";
import { subMonths, startOfMonth } from "date-fns";
import type {
  OwnerDashboardDTO,
  BusinessStatCardDTO,
  MonthlyEarningPointDTO,
  TopServiceDTO,
} from "./owner-dashboard.types";

const IST    = "Asia/Kolkata";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function istMonth(d: Date) {
  return formatInTimeZone(d, IST, "yyyy-MM"); 
}

function buildMonthlyBuckets(): Map<string, { month: string; year: number; earning_inr: number; booking_count: number }> {
  const map = new Map();
  const now  = new Date();
  for (let i = 11; i >= 0; i--) {
    const d   = subMonths(startOfMonth(now), i);
    const key = formatInTimeZone(d, IST, "yyyy-MM");
    map.set(key, {
      month:         MONTHS[parseInt(formatInTimeZone(d, IST, "MM")) - 1],
      year:          parseInt(formatInTimeZone(d, IST, "yyyy")),
      earning_inr:   0,
      booking_count: 0,
    });
  }
  return map;
}

export class OwnerDashboardService {

  private static async getOwnerData(userId: string) {
    const owner = await prisma.owner.findUnique({
      where:  { user_id: userId },
      select: { id: true },
    });
    if (!owner) throw new NotFoundError("Owner profile not found.");

    const businesses = await prisma.business.findMany({
      where:  { owner_id: owner.id },
      select: { id: true },
    });
    return { ownerId: owner.id, businessIds: businesses.map(b => b.id) };
  }

  static async getDashboard(
    userId: string,
    period: "week" | "month" | "year",
  ): Promise<OwnerDashboardDTO> {
    const { businessIds } = await this.getOwnerData(userId);

    if (!businessIds.length) {
      return this.emptyDashboard(period);
    }

    const [
      businesses,
      wallets,
      bookingStats,
      staffCounts,
      pendingLeaves,
      monthlyTxns,
      bestStaffResult,
      periodBookings,
      bestWallet,
    ] = await Promise.all([
      Repo.getBusinesses(businessIds),
      Repo.getWallets(businessIds),
      Repo.getTotalBookingStats(businessIds),
      Repo.getStaffCounts(businessIds),
      Repo.getPendingLeaveCount(businessIds),
      Repo.getMonthlyEarnings(businessIds),
      Repo.getBestStaff(businessIds, period),
      Repo.getCompletedBookingsForPeriod(businessIds, period),
      Repo.getBestBusiness(businessIds),
    ]);

    const walletMap = new Map(wallets.map(w => [w.business_id, w]));

    const totalEarnings = wallets.reduce((s, w) => s + w.lifetime_earnings, 0);
    const totalBalance  = wallets.reduce((s, w) => s + w.balance,           0);

    const summary = {
      total_earnings_inr:    totalEarnings  / 100,
      available_balance_inr: totalBalance   / 100,
      active_businesses:     businesses.filter(b => b.is_active ?? true).length,
      total_businesses:      businesses.length,
      total_bookings:        bookingStats.total,
      completed_bookings:    bookingStats.completed,
      cancelled_bookings:    bookingStats.cancelled,
      pending_reviews:       pendingLeaves,
      total_staff:           staffCounts.total,
      active_staff:          staffCounts.active,
    };

    const businessCards: BusinessStatCardDTO[] = businesses.map(b => {
      const wallet = walletMap.get(b.id);
      return {
        id:                 b.id,
        business_name:      b.business_name,
        primary_image:      (b as any).images?.[0]?.image_url ?? null,
        average_rating:     b.average_rating  ?? 0,
        total_reviews:      b.total_reviews   ?? 0,
        total_bookings:     (b as any)._count?.bookings ?? 0,
        completed_bookings: 0,   
        earning_inr:        wallet ? wallet.lifetime_earnings / 100 : 0,
        balance_inr:        wallet ? wallet.balance           / 100 : 0,
        active_staff:       (b as any)._count?.staff ?? 0,
        today_bookings:     0,   
        is_verified:        b.is_verified,
      };
    });

    const bestBusiness = bestWallet
      ? {
          id:             bestWallet.business.id,
          business_name:  bestWallet.business.business_name,
          primary_image:  (bestWallet.business as any).images?.[0]?.image_url ?? null,
          earning_inr:    bestWallet.lifetime_earnings / 100,
          total_bookings: 0,   
          average_rating: bestWallet.business.average_rating ?? 0,
        }
      : null;

    const bestStaff = bestStaffResult
      ? {
          id:                 bestStaffResult.staff.id,
          name:               bestStaffResult.staff.name,
          avatar_url:         bestStaffResult.staff.avatar_url   ?? null,
          business_name:      (bestStaffResult.staff as any).business?.business_name ?? "",
          average_rating:     bestStaffResult.staff.average_rating ?? 0,
          total_reviews:      bestStaffResult.staff.total_reviews  ?? 0,
          period_bookings:    bestStaffResult.period_bookings,
          period_earning_inr: bestStaffResult.period_earning / 100,
        }
      : null;

    const buckets = buildMonthlyBuckets();
    for (const txn of monthlyTxns) {
      const key = istMonth(txn.created_at);
      const bucket = buckets.get(key);
      if (bucket) {
        bucket.earning_inr   += txn.amount / 100;
        bucket.booking_count += 1;
      }
    }
    const monthlyEarnings: MonthlyEarningPointDTO[] = Array.from(buckets.values());

    const serviceAgg = new Map<string, { count: number; revenue: number }>();
    for (const booking of periodBookings) {
      const services = Array.isArray(booking.services) ? booking.services : [];
      for (const svc of services) {
        if (!svc || typeof svc !== "object") continue;
        const svcObj = svc as Record<string, any>;
        const name    = svcObj.name ?? svcObj.service_name ?? "Unknown";
        const priceRaw = svcObj.price ?? 0;
        const price   = typeof priceRaw === "number" ? priceRaw : Number(priceRaw) || 0;
        const current = serviceAgg.get(name) ?? { count: 0, revenue: 0 };
        serviceAgg.set(name, {
          count:   current.count + 1,
          revenue: current.revenue + (price / 100),
        });
      }
    }
    const topServices: TopServiceDTO[] = Array.from(serviceAgg.entries())
      .map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue * 100) / 100 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      summary,
      businesses:       businessCards,
      best_business:    bestBusiness,
      best_staff:       bestStaff,
      monthly_earnings: monthlyEarnings,
      top_services:     topServices,
      period,
    };
  }

  private static emptyDashboard(period: "week" | "month" | "year"): OwnerDashboardDTO {
    const buckets = buildMonthlyBuckets();
    return {
      summary: {
        total_earnings_inr:    0,
        available_balance_inr: 0,
        active_businesses:     0,
        total_businesses:      0,
        total_bookings:        0,
        completed_bookings:    0,
        cancelled_bookings:    0,
        pending_reviews:       0,
        total_staff:           0,
        active_staff:          0,
      },
      businesses:       [],
      best_business:    null,
      best_staff:       null,
      monthly_earnings: Array.from(buckets.values()),
      top_services:     [],
      period,
    };
  }
}
