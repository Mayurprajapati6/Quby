export interface FavouriteBusinessDTO {
  id:             string;    
  business_id:    string;
  business_name:  string;
  owner_name:     string;
  slug:           string;
  service_for:    string;
  city:           string;
  state:          string;
  address_line1:  string;
  primary_image:  string | null;
  average_rating: number;
  total_reviews:  number;
  opening_time:   string | null;
  closing_time:   string | null;
  is_open_now:    boolean;
  added_at:       Date;
}

export interface ToggleFavouriteResponseDTO {
  favourited:  boolean;  
  business_id: string;
}
