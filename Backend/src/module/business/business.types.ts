export interface BusinessProfileDTO {
  id:               string;
  business_name:    string;
  slug:             string;
  business_type:    string;
  service_for:      string;
  description:      string | null;
  address_line1:    string;
  address_line2:    string | null;
  city:             string;
  state:            string;
  pincode:          string;
  map_link:         string | null;
  latitude:         number | null;
  longitude:        number | null;
  business_email:   string | null;
  business_phone:   string | null;
  website_url:      string | null;
  instagram_url:    string | null;
  facebook_url:     string | null;
  twitter_url:      string | null;
  youtube_url:      string | null;
  whatsapp_number:  string | null;
  logo_url:         string | null;
  cover_image_url:  string | null;
  gallery:          Array<{
    id:           string;
    image_url:    string;
    is_primary:   boolean;
    sort_order:   number;
    caption:      string | null;
  }>;
  is_verified:      boolean;
  is_active:        boolean;
  average_rating:   number;
  total_reviews:    number;
  break_time_minutes:        number;
  cancellation_window_hours: number;
  owner_name:       string;
  owner_phone:      string | null;
  owner_avatar:     string | null;
}

export interface UpdateBusinessProfileDTO {
  business_name?:   string;
  description?:     string;
  address_line1?:   string;
  address_line2?:   string;
  city?:            string;
  state?:           string;
  pincode?:         string;
  map_link?:        string;
  business_phone?:  string;
  website_url?:     string;
  instagram_url?:   string;
  facebook_url?:    string;
  twitter_url?:     string;
  youtube_url?:     string;
  whatsapp_number?: string;
  break_time_minutes?: number;
}

export interface BusinessServiceItemDTO {
  id:               string;
  platform_service: {
    id:          string;
    name:        string;
    category:    string | null;
    service_for: string;
  };
  price:            number;
  discounted_price: number | null;
  is_active:        boolean;
  is_featured:      boolean;
  booking_count:    number;
}

export interface AddServiceDTO {
  platform_service_id: string;
  price:               number;
  discounted_price?:   number;
  is_featured?:        boolean;
}

export interface UpdateServiceDTO {
  price?:            number;
  discounted_price?: number | null;
  is_featured?:      boolean;
  is_active?:        boolean;
}

export interface ScheduleItemDTO {
  id:          string;
  day_of_week: string;
  is_open:     boolean;
  open_time:   string | null;
  close_time:  string | null;
}

export interface HolidayItemDTO {
  id:                   string;
  holiday_name:         string;
  description:          string | null;
  start_date:           string;  
  end_date:             string;
  applies_to_all_staff: boolean;
  staff_count:          number;  
}

export interface CreateHolidayDTO {
  holiday_name:          string;
  description?:          string;
  start_date:            string;  
  end_date:              string;
  applies_to_all_staff?: boolean;
  staff_ids?:            string[];
}