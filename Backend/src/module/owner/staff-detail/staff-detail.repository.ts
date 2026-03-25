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
              include: { platform_service: { select: { id: true, name: true, category: true } } },
            },
          },
          orderBy: { is_available: "desc" },
        },
        schedules: { orderBy: { day_of_week: "asc" } },
      },
    });
  }

  // ── Period-filtered booking stats ────────────────────────────────────────────

  static async getPeriodStats(staffId: string, period: "week" | "month" | "year") {
    const now   = new Date();
    const start = period === "week"
      ? startOfWeek(now, { weekStartsOn: 1 })
      : period === "month"
        ? startOfMonth(now)
        : startOfYear(now);

    const bookings = await prisma.booking.findMany({
      where: {
        staff_id:     staffId,
        service_date: { gte: start },
      },
      select: { status: true, service_amount: true },
    });

    const completed  = bookings.filter(b => b.status === "COMPLETED");
    const cancelled  = bookings.filter(b => b.status === "CANCELLED" || b.status === "CANCELLED_TIMEOUT");
    const noShow     = bookings.filter(b => b.status === "CANCELLED_NO_SHOW");
    const revenue    = completed.reduce((s: number, b: any) => s + (b.service_amount ?? 0), 0);

    const denom    = completed.length + cancelled.length + noShow.length;
    const accuracy = denom > 0 ? Math.round(completed.length / denom * 100) : 100;

    // Timing performance from StaffPerformance monthly records
    const perfRecords = await prisma.staffPerformance.findMany({
      where: { staff_id: staffId, month: { gte: start } },
    });

    const totalBookingsPerf   = perfRecords.reduce((s, r) => s + r.total_bookings, 0);
    const totalActualMins     = perfRecords.reduce((s, r) => s + r.total_actual_minutes, 0);
    const totalEstimatedMins  = perfRecords.reduce((s, r) => s + r.total_estimated_minutes, 0);
    const totalOnTime         = perfRecords.reduce((s, r) => s + r.on_time_count, 0);
    const totalEffSum         = perfRecords.reduce((s, r) => s + r.average_efficiency * r.total_bookings, 0);

    const avgTakenMin      = totalBookingsPerf > 0 ? Math.round(totalActualMins    / totalBookingsPerf) : 0;
    const avgEstimatedMin  = totalBookingsPerf > 0 ? Math.round(totalEstimatedMins / totalBookingsPerf) : 0;
    const avgEfficiencyPct = totalBookingsPerf > 0 ? Math.round(totalEffSum        / totalBookingsPerf) : 100;
    const onTimePct        = totalBookingsPerf > 0 ? Math.round(totalOnTime        / totalBookingsPerf * 100) : 100;

    // Rating for this period
    const rating = await prisma.review.aggregate({
      where:  { staff_id: staffId, created_at: { gte: start } },
      _avg:   { staff_rating: true },
      _count: { id: true },
    });

    return {
      period,
      total_bookings:     bookings.length,
      completed_bookings: completed.length,
      cancelled_bookings: cancelled.length,
      no_show_bookings:   noShow.length,
      revenue_inr:        revenue / 100,
      accuracy_percent:   accuracy,
      avg_rating:         Math.round((rating._avg.staff_rating ?? 0) * 10) / 10,
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