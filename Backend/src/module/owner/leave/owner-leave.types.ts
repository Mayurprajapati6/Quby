export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface LeaveListItemDTO {
  id:               string;
  staff_id:         string;
  staff_name:       string;
  staff_avatar:     string | null;

  business_id:      string;
  business_name:    string;
  business_logo:    string | null; // ✅ ADD

  leave_type:       string;
  start_date:       string;
  end_date:         string;
  reason:           string;
  status:           LeaveStatus;
  rejection_reason: string | null;
  approved_at:      string | null;
  created_at:       string;
}

export interface ProcessLeaveDTO {
  action:            "APPROVED" | "REJECTED";
  rejection_reason?: string;
}
