export interface RequestLeaveDTO {
  leave_type: "PERSONAL" | "SICK" | "EMERGENCY" | "OTHER";
  start_date: string;   
  end_date:   string;   
  reason:     string;
}

export interface StaffLeaveItemDTO {
  id:               string;
  leave_type:       string;
  start_date:       Date;
  end_date:         Date;
  reason:           string;
  status:           "PENDING" | "APPROVED" | "REJECTED";
  approved_by:      string | null;
  approved_at:      Date | null;
  rejection_reason: string | null;
  created_at:       Date;
}
