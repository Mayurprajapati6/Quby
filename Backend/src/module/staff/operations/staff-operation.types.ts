export interface ValidateQrDTO {
  qr_code_id:  string;
  scan_method: "CAMERA" | "MANUAL";
  client_time?: string;
}

export interface ReportDelayDTO {
  delay_minutes: number;
}

export interface RequestLeaveDTO {
  start_date: string;   
  end_date:   string;   
  reason:     string;
  leave_type: "PERSONAL" | "SICK" | "EMERGENCY" | "OTHER";
}
