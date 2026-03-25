export interface OwnerProfile {
  id:               string;
  name:             string;
  email:            string;
  phone:            string | null;
  avatar_url:       string | null;
  city:             string | null;
  state:            string | null;
  address_line1:    string | null;
  address_line2:    string | null;
  join_date:        string;           
  total_businesses: number;
  active_businesses: number;
}

export interface UpdateOwnerProfileDTO {
  name?:          string;
  phone?:         string;
  city?:          string;
  state?:         string;
  address_line1?: string;
  address_line2?: string;
}

export interface BusinessCardDTO {
  id:                string;
  business_name:     string;
  slug:              string;
  city:              string;
  state:             string;
  service_for:       string;
  primary_image:     string | null;
  logo_url:          string | null;
  is_verified:       boolean;
  is_active:         boolean;
  average_rating:    number;
  total_reviews:     number;
  active_staff_count: number;
  total_earning_inr: number;           
  today_bookings:    number;
  created_at:        string;           
}

export interface MyBusinessesResponseDTO {
  businesses:  BusinessCardDTO[];
  total:       number;
  page:        number;
  limit:       number;
  total_pages: number;
}

export interface MyBusinessesFilters {
  name?:   string;
  city?:   string;
  state?:  string;
  page?:   number;
  limit?:  number;
}
