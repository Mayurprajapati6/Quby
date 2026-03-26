export interface CustomerProfile {
  id:              string;
  username:        string;
  name:            string;
  email:           string;
  phone:           string | null;
  avatar_url:      string | null;
  gender:          string | null;
  city:            string;
  state:           string;
  country:         string;
  address_line1:   string | null;
  address_line2:   string | null;
  join_date:       string;          
  first_login_at:  string | null;   
  last_login_at:   string | null;   
  total_bookings:     number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_spent:        number;       
}
export interface UpdateCustomerProfileDTO {
  name?:          string;
  phone?:         string;
  city?:          string;
  state?:         string;
  gender?:        string;
  address_line1?: string;
  address_line2?: string;
}
