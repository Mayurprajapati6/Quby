import api from '@/lib/axios'

export type DashboardPeriod = 'week' | 'month' | 'year'
export type GrowthPeriod = 'daily' | 'weekly' | 'monthly'

export interface AdminDashboardSummaryDTO {
  period: DashboardPeriod
  users: {
    total_customers: number
    total_owners: number
    total_staff: number
    total_admins: number
    new_in_period: number
  }
  businesses: {
    total: number
    active: number
    inactive: number
    new_in_period: number
  }
  today: {
    date: string
    total_bookings: number
    completed: number
    cancelled: number
    no_shows: number
    gross_revenue_inr: number
  }
  revenue: {
    today_inr: number
    period_inr: number
    this_month_inr: number
    all_time_inr: number
    refunds_this_month_inr: number
    net_this_month_inr: number
  }
  bookings: {
    period_total: number
    period_completed: number
    period_cancelled: number
    completion_rate: number
  }
  monthly_revenue: Array<{
    label: string
    year: number
    revenue_inr: number
    count: number
  }>
  top_businesses: Array<{
    business_id: string
    business_name: string
    city: string
    state: string
    average_rating: number
    booking_count: number
    revenue_inr: number
  }>
  top_cities: Array<{
    city: string
    state: string
    total_bookings: number
    business_count: number
  }>
}

export interface AdminDashboardAnalyticsDTO {
  lifetime_counts: {
    customers: number
    owners: number
    staff: number
    businesses: number
  }
  growth_data: Array<{
    period: string
    customers: number
    owners: number
    staff: number
    businesses: number
  }>
  top_businesses: {
    monthly: Array<{
      business_id: string
      business_name: string
      city: string
      state?: string
      service_for: string
      average_rating: number
      booking_count: number
      revenue_inr?: number
      logo_url?: string | null
    }>
    yearly: Array<{
      business_id: string
      business_name: string
      city: string
      state?: string
      service_for: string
      average_rating: number
      booking_count: number
      revenue_inr?: number
      logo_url?: string | null
    }>
  }
  weekly_services: Array<{ name: string; count: number }>
  city_distribution: Array<{
    city: string
    state: string
    businesses: number
    customers: number
    owners: number
    staff: number
  }>
  salon_type_distribution: { men: number; unisex: number }
  owner_business_count: Array<{
    owner_id: string
    name: string
    avatar_url?: string | null
    city: string
    total_businesses: number
    active_businesses: number
  }>
  period: GrowthPeriod
}

export interface AdminDashboardState {
  summary: AdminDashboardSummaryDTO
  analytics: AdminDashboardAnalyticsDTO
  booking_breakdown: Array<{
    label: string
    value: number
    color: string
  }>
  kpis: {
    revenue: {
      value: number
      sub: string
    }
    bookings: {
      value: number
      sub: string
    }
    users: {
      value: number
      sub: string
    }
    businesses: {
      value: number
      sub: string
    }
  }
}

function dataOf<T>(res: { data: { data: T } }) {
  return res.data.data
}

function buildBookingBreakdown(summary: AdminDashboardSummaryDTO) {
  const active =
    summary.bookings.period_total -
    summary.bookings.period_completed -
    summary.bookings.period_cancelled

  return [
    { label: 'Completed', value: summary.bookings.period_completed, color: '#34d399' },
    { label: 'Cancelled', value: summary.bookings.period_cancelled, color: '#ef4444' },
    { label: 'Active', value: Math.max(0, active), color: '#60a5fa' },
  ].filter(item => item.value > 0)
}

export async function getAdminDashboardState(
  dashboardPeriod: DashboardPeriod,
  growthPeriod: GrowthPeriod,
): Promise<AdminDashboardState> {
  const [summaryRes, analyticsRes] = await Promise.all([
    api.get('/admin/dashboard', { params: { period: dashboardPeriod } }),
    api.get('/admin/dashboard/analytics', { params: { period: growthPeriod } }),
  ])

  const summary = dataOf<AdminDashboardSummaryDTO>(summaryRes)
  const analytics = dataOf<AdminDashboardAnalyticsDTO>(analyticsRes)
  const totalUsers =
    summary.users.total_customers +
    summary.users.total_owners +
    summary.users.total_staff +
    summary.users.total_admins

  return {
    summary,
    analytics,
    booking_breakdown: buildBookingBreakdown(summary),
    kpis: {
      revenue: {
        value: summary.revenue.period_inr,
        sub: `Rs ${summary.revenue.today_inr.toLocaleString('en-IN')} today`,
      },
      bookings: {
        value: summary.bookings.period_total,
        sub: `${summary.bookings.completion_rate}% completion rate`,
      },
      users: {
        value: totalUsers,
        sub: `${summary.users.new_in_period.toLocaleString('en-IN')} new in period`,
      },
      businesses: {
        value: summary.businesses.active,
        sub: `${summary.businesses.total.toLocaleString('en-IN')} total businesses`,
      },
    },
  }
}

