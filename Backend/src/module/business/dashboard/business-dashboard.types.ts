// ─────────────────────────────────────────────────────────────────────────────
// FILE   : business/dashboard/business-dashboard.types.ts
// A48    : Business dashboard DTO shapes
// ─────────────────────────────────────────────────────────────────────────────

// ── Summary cards ─────────────────────────────────────────────────────────────

export interface BusinessDashboardSummaryDTO {
  total_earnings_inr:   number;  // wallet lifetime_earnings
  available_balance_inr: number; // wallet current balance
  total_bookings:       number;
  completed_bookings:   number;
  cancelled_bookings:   number;
  today_bookings:       number;
  average_rating:       number;
  total_reviews:        number;
  active_staff:         number;
  total_staff:          number;
  pending_leave_requests: number;
}

// ── Staff performance card ─────────────────────────────────────────────────────

export interface StaffPerformanceCardDTO {
  id:                string;
  name:              string;
  avatar_url:        string | null;
  average_rating:    number;
  total_reviews:     number;
  period_bookings:   number;   // completed in selected period
  period_earning_inr: number;
  accuracy_percent:  number;   // completed / (completed + cancelled + no_show) * 100
  avg_taken_min:      number;
  avg_estimated_min:  number;
  avg_efficiency_pct: number;
  on_time_pct:        number;
}

// ── Best staff ────────────────────────────────────────────────────────────────

export interface BestStaffDTO {
  id:                string;
  name:              string;
  avatar_url:        string | null;
  average_rating:    number;
  period_bookings:   number;
  period_earning_inr: number;
}

// ── Most booked service ───────────────────────────────────────────────────────

export interface TopServiceDTO {
  name:    string;
  count:   number;
  revenue_inr: number;
}

// ── Monthly earnings chart ────────────────────────────────────────────────────

export interface MonthlyEarningPointDTO {
  month:         string;   // "Jan"
  year:          number;
  earning_inr:   number;
  booking_count: number;
}

// ── Full dashboard response ───────────────────────────────────────────────────

export interface BusinessDashboardDTO {
  summary:          BusinessDashboardSummaryDTO;
  staff_performance: StaffPerformanceCardDTO[];
  best_staff:       BestStaffDTO | null;
  top_services:     TopServiceDTO[];
  monthly_earnings: MonthlyEarningPointDTO[];
  period:           "week" | "month" | "year";
}