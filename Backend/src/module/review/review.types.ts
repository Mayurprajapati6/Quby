export interface SubmitReviewDTO {
  booking_id: string;
  rating:     number;   
  comment?:   string;   
}

export interface PendingReviewItemDTO {
  booking_id:     string;
  booking_number: string;
  business_id:    string;
  business_name:  string;
  business_logo:  string | null;
  staff_id:       string;
  staff_name:     string;
  staff_avatar:   string | null;
  service_date:   string;    
  services: { name: string; image: string | null }[];
}

export interface ReviewItemDTO {
  id:           string;
  booking_id:   string;
  business_id:  string;
  staff_id:     string;
  rating:       number;
  comment:      string | null;
  images:       string[];
  business_response:    string | null;
  business_response_at: string | null;
  is_verified:  boolean;
  created_at:   string;
  
  business_name:  string;
  business_logo:  string | null;
  staff_name:     string;
  staff_avatar:   string | null;
  services: { name: string; image: string | null }[];
}

export interface MyReviewsResponseDTO {
  reviews:    ReviewItemDTO[];
  pagination: { total: number; page: number; limit: number; total_pages: number };
}

export interface StaffReviewItemDTO {
  id:      string;
  rating:  number;
  comment: string | null;
  images:  string[];
  business_response:    string | null;
  business_response_at: string | null;
  created_at: string;
  customer: { id: string; name: string; avatar_url: string | null };
  booking:  { id: string; booking_number: string; service_date: string; services: { name: string; image: string | null }[]; };
}

export interface BusinessReviewItemDTO {
  id:      string;
  rating:  number;
  comment: string | null;
  images:  string[];
  business_response:    string | null;
  business_response_at: string | null;
  is_verified: boolean;
  created_at:  string;
  customer:  { id: string; name: string; avatar_url: string | null };
  staff:     { id: string; name: string; avatar_url: string | null };
  booking:   { id: string; booking_number: string; service_date: string; services: string[] };
}
