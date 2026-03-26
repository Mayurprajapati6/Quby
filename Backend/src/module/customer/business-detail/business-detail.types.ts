export interface PublicBusinessProfileDTO {
  id:              string;
  slug:            string;
  business_name:   string;
  owner_name:      string;        
  service_for:     string;
  description:     string | null;
  address_line1:   string;
  address_line2:   string | null;
  city:            string;
  state:           string;
  pincode:         string;
  latitude:        number | null;
  longitude:       number | null;
  map_link:        string | null; 
  business_phone:  string | null;
  business_email:  string | null;
  website_url:     string | null;

  social_links: {
    instagram:  string | null;
    facebook:   string | null;
    twitter:    string | null;
    youtube:    string | null;
    whatsapp:   string | null;
  };

  primary_image:   string | null;  
  gallery:         PublicImageItemDTO[];

  average_rating:  number;
  total_reviews:   number;

  is_open_now:     boolean;
  schedules:       ScheduleDayDTO[];
  todays_schedule: TodayScheduleDTO | null;

  is_favourited:   boolean;

  services:        PublicServiceItemDTO[];
  staff:           PublicStaffItemDTO[];
  reviews:         PublicReviewItemDTO[];
  review_summary:  ReviewSummaryDTO;
}

export interface ScheduleDayDTO {
  day_of_week: string;
  is_open:     boolean;
  open_time:   string | null;
  close_time:  string | null;
}

export interface TodayScheduleDTO {
  day_of_week: string;
  is_open:     boolean;
  open_time:   string | null;
  close_time:  string | null;
}

export interface PublicServiceItemDTO {
  id:               string;   
  name:             string;   
  service_for:      string;
  price:            number;
  discounted_price: number | null;
  is_featured:      boolean;
}

export interface PublicStaffItemDTO {
  id:               string;
  name:             string;
  avatar_url:       string | null;
  specialization:   string | null;
  experience_years: number | null;
  bio:              string | null;
  average_rating:   number;
  total_reviews:    number;
  status:           "FREE" | "BUSY" | "OFF";

  services: {
    offering_id:      string;   
    name:             string;
    duration_minutes: number;
  }[];
}

export interface StaffReviewItemDTO {
  id:             string;
  staff_rating:   number;
  staff_comment:  string | null;
  staff_response: string | null;          
  staff_response_at: string | null;       
  images:         string[];
  created_at:     string;
  customer: {
    name:       string;
    avatar_url: string | null;
  };
}

export interface StaffReviewsPageDTO {
  staff_id:       string;
  staff_name:     string;
  staff_avatar:   string | null;
  average_rating: number;
  total_reviews:  number;
  reviews:        StaffReviewItemDTO[];
  pagination: {
    total:       number;
    page:        number;
    limit:       number;
    total_pages: number;
  };
}

export interface PublicImageItemDTO {
  id:         string;
  image_url:  string;
  sort_order: number;
  is_primary: boolean;
}

export interface PublicReviewItemDTO {
  id:                   string;
  overall_rating:       number;
  staff_rating:         number;
  business_rating:      number;
  staff_comment:        string | null;
  business_comment:     string | null;
  images:               string[];        
  business_response:    string | null;
  business_response_at: string | null;   
  staff_response:       string | null;   
  staff_response_at:    string | null;   
  created_at:           string;          
  customer: {
    name:       string;
    avatar_url: string | null;
  };
  staff: {
    id:         string;
    name:       string;
    avatar_url: string | null;
  };
}

export interface ReviewSummaryDTO {
  average_rating:   number;
  total_reviews:    number;
  rating_breakdown: {
    five:  number;
    four:  number;
    three: number;
    two:   number;
    one:   number;
  };
}
