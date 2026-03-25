export interface ScheduleItemDTO {
  id:          string;
  day_of_week: string;
  is_open:     boolean;
  open_time:   string | null;
  close_time:  string | null;
}

export interface UpdateScheduleDTO {
  schedules: Array<{
    day_of_week: string;
    is_open:     boolean;
    open_time?:  string;
    close_time?: string;
  }>;
}

export interface HolidayItemDTO {
  id:                   string;
  holiday_name:         string;
  description:          string | null;
  start_date:           Date;
  end_date:             Date;
  applies_to_all_staff: boolean;
  created_by_role:      string;
  affected_staff_count: number;
}

export interface CreateHolidayDTO {
  holiday_name:         string;
  description?:         string;
  start_date:           string;
  end_date:             string;
  applies_to_all_staff: boolean;
}

export interface UpcomingHolidayDTO {
  date:         string;  
  holidayName:  string;
  staffOnLeave: Array<{ staffId: string; staffName: string }>;
}
