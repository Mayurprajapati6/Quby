export type HolidayTab = "upcoming" | "running" | "completed";

export interface HolidayItemDTO {
  id:                   string;
  business_id:          string;
  business_name:        string;
  holiday_name:         string;
  description:          string | null;
  start_date:           string;   
  end_date:             string;
  applies_to_all_staff: boolean;
  staff_ids:            string[]; 
  staff_names:          string[]; 
  tab:                  HolidayTab;
  created_at:           string;
}

export interface CreateHolidayDTO {
  business_id:           string;
  holiday_name:          string;
  description?:          string;
  start_date:            string;  
  end_date:              string;
  applies_to_all_staff?: boolean;
  staff_ids?:            string[]; 
}

export interface UpdateHolidayDTO {
  holiday_name?:         string;
  description?:          string;
  start_date?:           string;
  end_date?:             string;
  applies_to_all_staff?: boolean;
  staff_ids?:            string[];
}
