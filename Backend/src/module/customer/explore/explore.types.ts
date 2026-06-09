export interface ExploreFilters {
  name?:        string;
  query?:       string;      
  city?:        string;
  state?:       string;      
  service_for?: "MEN" | "UNISEX";   
  min_rating?:  number;
  is_open?:     boolean;
  lat?:         number;
  lng?:         number;
  radius_km?:   number;
  page?:        number;
  limit?:       number;
  customerId?:  string;
}

export interface BusinessCardDTO {
  id:             string;
  slug:           string;
  business_name:  string;
  owner_name:     string;         
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
  distance_km?:   number;
}

export interface ExploreResponse {
  businesses: BusinessCardDTO[];
  pagination: {
    total:       number;
    page:        number;
    limit:       number;
    total_pages: number;
  };
}
