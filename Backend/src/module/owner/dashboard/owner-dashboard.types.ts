export interface OwnerDashboardDTO {
  summary: {
  total_earnings_inr: number;
  no_show_earnings_inr: number;

  completed_earnings_inr: number; // 🔥 ADD
  upcoming_earnings_inr: number;  // 🔥 ADD

  active_businesses: number;
  total_businesses: number;

  total_bookings: number;
  completed_bookings: number;
  refunded_bookings: number;
  no_show_bookings: number;
  upcoming_bookings: number;
  today_bookings: number;

  pending_leaves: number;

  total_staff: number;
  active_staff: number;
};
  businesses:       BusinessStatCardDTO[];
  best_staff:       BestStaffDTO | null;
  monthly_earnings: MonthlyEarningPointDTO[];
  top_services:     TopServiceDTO[];

  // 🔥 NEW
  business_chart: BusinessChartDTO[];
  staff_chart: StaffChartDTO[];

}

export interface BusinessStatCardDTO {
  id:                  string;
  business_name:       string;
  primary_image:       string | null;
  average_rating:      number;
  total_reviews:       number;
  total_bookings:      number;
  active_staff:        number;
  settled_earning_inr: number;
  pending_earning_inr: number;
}

export interface BestStaffDTO {
  id:                 string;
  name:               string;
  avatar_url:         string | null;
  business_name:      string;
  average_rating:     number;
  total_reviews:      number;
  period_bookings:    number;
  period_earning_inr: number;
}

export interface MonthlyEarningPointDTO {
  month:         string;
  year:          number;
  earning_inr:   number;
  booking_count: number;
}

export interface TopServiceDTO {
  name:    string;
  count:   number;
  revenue: number;
  percentage: number;   // 🔥 already using in UI
  image: string | null; // 🔥 THIS WAS MISSING
}

export interface BusinessChartDTO {
  business_id: string;
  business_name: string;
  logo: string | null;
  earning_inr: number;
}

export interface StaffChartDTO {
  staff_id: string;
  staff_name: string;
  avatar: string | null;
  bookings: number;
  earning_inr: number;
}