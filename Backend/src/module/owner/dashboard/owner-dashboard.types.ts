export interface OwnerDashboardSummaryDTO {
  total_earnings_inr:   number;   
  available_balance_inr: number;  
  active_businesses:    number;
  total_businesses:     number;
  total_bookings:       number;
  completed_bookings:   number;
  cancelled_bookings:   number;
  pending_reviews:      number;   
  total_staff:          number;
  active_staff:         number;
}

export interface BusinessStatCardDTO {
  id:                  string;
  business_name:       string;
  primary_image:       string | null;
  average_rating:      number;
  total_reviews:       number;
  total_bookings:      number;   
  completed_bookings:  number;
  earning_inr:         number;   
  balance_inr:         number;   
  active_staff:        number;
  today_bookings:      number;
  is_verified:         boolean;
}

export interface BestBusinessDTO {
  id:             string;
  business_name:  string;
  primary_image:  string | null;
  earning_inr:    number;
  total_bookings: number;
  average_rating: number;
}

export interface BestStaffDTO {
  id:               string;
  name:             string;
  avatar_url:       string | null;
  business_name:    string;
  average_rating:   number;
  total_reviews:    number;
  period_bookings:  number;   
  period_earning_inr: number;
}

export interface MonthlyEarningPointDTO {
  month:          string;   
  year:           number;
  earning_inr:    number;
  booking_count:  number;
}

export interface TopServiceDTO {
  name:    string;
  count:   number;         
  revenue: number;         
}

export interface OwnerDashboardDTO {
  summary:           OwnerDashboardSummaryDTO;
  businesses:        BusinessStatCardDTO[];
  best_business:     BestBusinessDTO | null;
  best_staff:        BestStaffDTO | null;
  monthly_earnings:  MonthlyEarningPointDTO[];   
  top_services:      TopServiceDTO[];             
  period:            "week" | "month" | "year"; 
}
