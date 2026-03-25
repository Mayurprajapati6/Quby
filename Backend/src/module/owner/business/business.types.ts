export interface CreateBusinessDTO {
  business_name:      string;
  business_type?:     string;
  service_for:        "MEN" | "WOMEN" | "UNISEX";
  description?:       string;
  address_line1:      string;
  address_line2?:     string;
  city:               string;
  state:              string;
  pincode:            string;
  country?:           string;
  latitude?:          number;
  longitude?:         number;
  map_link?:          string;
  business_phone?:    string;
  website_url?:       string;
  instagram_url?:     string;
  facebook_url?:      string;
  twitter_url?:       string;
  youtube_url?:       string;
  whatsapp_number?:   string;
  break_time_minutes?:        number;
  cancellation_window_hours?: number;
}

export type UpdateBusinessDTO = Partial<CreateBusinessDTO>;
export interface SetPrimaryImageDTO {
  image_id: string;
}