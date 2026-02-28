export interface PlatformServiceDTO {
  id:          string;
  name:        string;
  description: string | null;
  service_for: string;        
  image_url:   string | null;
  is_active:   boolean;
  sort_order:  number;
  created_at:   Date;
  updated_at:   Date;
}

export interface CreatePlatformServiceDTO {
  name:         string;
  description?: string;
  service_for:  "MEN" | "UNISEX";
  sort_order?:  number;
}

export interface UpdatePlatformServiceDTO {
  name?:        string;
  description?: string;
  sort_order?:  number;
  is_active?:   boolean;
}