export interface StaffHolidayItemDTO {
  id:                   string;
  holiday_name:         string;
  description:          string | null;
  start_date:           Date;
  end_date:             Date;
  applies_to_all_staff: boolean;
  created_at:           Date;
}
