export interface BusinessServiceOfferingDTO {
  id:               string;
  platform_service: {
    id:          string;
    name:        string;
    service_for: string;
    category:    string;
  };
  price:            number;
  discounted_price: number | null;
  is_featured:      boolean;
  is_active:        boolean;
  created_at:       Date;
}

export interface AddBusinessServiceDTO {
  platform_service_id: string;
  price:               number;
  discounted_price?:   number;
  is_featured?:        boolean;
}

export interface UpdateBusinessServiceDTO {
  price?:            number;
  discounted_price?: number | null;
  is_featured?:      boolean;
  is_active?:        boolean;
}
