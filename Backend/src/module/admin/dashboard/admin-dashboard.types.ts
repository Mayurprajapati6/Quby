export interface AdminDashboardDTO {

  users: {
    total_customers: number;
    total_owners:    number;
    total_staff:     number;
    total_admins:    number;
    new_today:       number;     
    new_this_week:   number;
    new_this_month:  number;
  };

  businesses: {
    total:              number;
    verified:           number;
    pending_verification: number;   
    active:             number;
    inactive:           number;
    new_this_month:     number;
  };

  today: {
    date:             string;    
    total_bookings:   number;
    completed:        number;
    cancelled:        number;
    no_shows:         number;
    platform_revenue: number;    
    gross_bookings:   number;    
  };

  revenue: {
    today:        number;   
    this_week:    number;
    this_month:   number;
    all_time:     number;
    refunds_this_month: number;
    net_this_month:     number;
  };

  top_businesses: TopBusinessItemDTO[];

  top_cities: TopCityItemDTO[];

  pending: {
    verification_queue: number;   
  };
}

export interface TopBusinessItemDTO {
  business_id:    string;
  business_name:  string;
  city:           string;
  total_bookings: number;
  platform_fee:   number;   
  average_rating: number;
}

export interface TopCityItemDTO {
  city:           string;
  state:          string;
  total_bookings: number;
  business_count: number;
}
