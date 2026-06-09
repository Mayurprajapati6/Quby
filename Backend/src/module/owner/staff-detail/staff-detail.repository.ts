// ─────────────────────────────────────────────────────────────────────────────
// FILE   : owner/staff-detail/staff-detail.repository.ts
// A42    : Complete — all queries for the staff detail page
// ─────────────────────────────────────────────────────────────────────────────

import { prisma }          from "../../../config/prisma";
import { startOfWeek, startOfMonth, startOfYear } from "date-fns";

export class StaffDetailRepository {

  // ── Full staff profile ────────────────────────────────────────────────────────

  static async findFull(staffId: string) {
    return prisma.staff.findUnique({
      where:   { id: staffId },
      include: {
        business:  { select: { id: true, business_name: true } },
        user:      { select: { id: true, email: true } },
        services:  {
          include: {
            service_offering: {
              include: { platform_service: { select: { id: true, name: true, category: true, image_url: true } } },
            },
          },
          orderBy: { is_available: "desc" },
        },
        schedules: { orderBy: { day_of_week: "asc" } },
      },
    });
  }

  // ── Period-filtered booking stats ────────────────────────────────────────────

  static async getPeriodStats(
  staffId: string,
  _period: "week" | "month" | "year"
) {
  const bookings = await prisma.booking.findMany({
    where: {
      staff_id: staffId, // ✅ ALL TIME
    },
    select: { status: true, service_amount: true },
  });

  const completed  = bookings.filter(b => b.status === "COMPLETED");
  const cancelled  = bookings.filter(b => b.status === "CANCELLED");
  const noShow     = bookings.filter(b => b.status === "NO_SHOW");

  const revenue = completed.reduce(
    (s: number, b: any) => s + (b.service_amount ?? 0),
    0
  );

  const denom    = completed.length + cancelled.length + noShow.length;
  const accuracy = denom > 0 ? Math.round((completed.length / denom) * 100) : 100;

  // ALL TIME performance
  const perfRecords = await prisma.staffPerformance.findMany({
    where: { staff_id: staffId },
  });

  const totalBookingsPerf   = perfRecords.reduce((s, r) => s + r.total_bookings, 0);
  const totalActualMins     = perfRecords.reduce((s, r) => s + r.total_actual_minutes, 0);
  const totalEstimatedMins  = perfRecords.reduce((s, r) => s + r.total_estimated_minutes, 0);
  const totalOnTime         = perfRecords.reduce((s, r) => s + r.on_time_count, 0);
  const totalEffSum         = perfRecords.reduce(
    (s, r) => s + r.average_efficiency * r.total_bookings,
    0
  );

  const avgTakenMin      = totalBookingsPerf > 0 ? Math.round(totalActualMins / totalBookingsPerf) : 0;
  const avgEstimatedMin  = totalBookingsPerf > 0 ? Math.round(totalEstimatedMins / totalBookingsPerf) : 0;
  const avgEfficiencyPct = totalBookingsPerf > 0 ? Math.round(totalEffSum / totalBookingsPerf) : 100;
  const onTimePct        = totalBookingsPerf > 0 ? Math.round((totalOnTime / totalBookingsPerf) * 100) : 100;

  // ALL TIME rating
  const rating = await prisma.review.aggregate({
    where: { staff_id: staffId },
    _avg:   { rating: true },
    _count: { id: true },
  });

  return {
    // ✅ REQUIRED FOR TYPE (but now logical)
    period: "lifetime",

    total_bookings:     bookings.length,
    completed_bookings: completed.length,
    cancelled_bookings: cancelled.length,
    no_show_bookings:   noShow.length,

    // ⚠️ keep paise
    revenue_inr: revenue,

    accuracy_percent:   accuracy,
    avg_rating:         Math.round((rating._avg.rating ?? 0) * 10) / 10,
    total_reviews:      rating._count.id,

    avg_taken_min:      avgTakenMin,
    avg_estimated_min:  avgEstimatedMin,
    avg_efficiency_pct: avgEfficiencyPct,
    on_time_pct:        onTimePct,
  };
}

  // ── Recent bookings ───────────────────────────────────────────────────────────

  static async getRecentBookings(staffId: string, take = 10) {
    return prisma.booking.findMany({
      where:   { staff_id: staffId },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: [{ service_date: "desc" }, { service_start_time: "desc" }],
      take,
    });
  }

  // ── Recent reviews ────────────────────────────────────────────────────────────

  static async getRecentReviews(staffId: string, take = 5) {
    return prisma.review.findMany({
      where:   { staff_id: staffId, is_visible: true },
      include: {
        customer: { select: { name: true } },
        booking:  { select: { service_date: true } },
      },
      orderBy: { created_at: "desc" },
      take,
    });
  }
}