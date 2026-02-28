export interface BusinessDTO {
    id:             string;
    business_name:  string;
    slug:           string;
    business_type:  string;
    service_for:    string;
    description:    string | null;
    address_line1:  string;
    address_line2:  string | null;
    city:           string;
    state:          string;
    pincode:        string;
    latitude:       number | null;
    longitude:      number | null;
    business_email: string | null;
    business_phone: string | null;
    website_url:    string | null;
    is_verified:    boolean;
    is_active:      boolean;
    average_rating: number | null;
    total_reviews:  number;
    images:         BusinessImageDTO[];
    schedules:      BusinessScheduleDTO[];
    created_at:      Date;
    updated_at:      Date;
}

export interface BusinessImageDTO {
    id:         string;
    image_url:  string;
    is_primary: boolean;
    sort_order: number;
    caption:    string | null;
}

export interface BusinessScheduleDTO {
    day_of_week: string;
    is_open:     boolean;
    open_time:   string | null;
    close_time:  string | null;
}

export interface CreateBusinessDTO {
    business_name:   string;
    service_for:     "MEN" | "UNISEX";
    description?:    string;
    address_line1:   string;
    address_line2?:  string;
    city:            string;
    state:           string;
    pincode:         string;
    latitude?:       number;
    longitude?:      number;
    business_email?: string;
    business_phone?: string;
    website_url?:    string;
}

export interface UpdateBusinessDTO {
    business_name?:  string;
    description?:    string;
    address_line1?:  string;
    address_line2?:  string;
    city?:           string;
    state?:          string;
    pincode?:        string;
    latitude?:       number;
    longitude?:      number;
    business_email?: string;
    business_phone?: string;
    website_url?:    string;
}