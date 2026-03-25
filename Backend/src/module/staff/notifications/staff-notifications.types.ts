export interface StaffNotificationDTO {
  id:         string;
  type:       string;
  title:      string;
  message:    string;
  data:       Record<string, any> | null;
  action_url: string | null;
  is_read:    boolean;
  read_at:    Date | null;
  created_at: Date;
}

export interface StaffNotificationsResponseDTO {
  notifications: StaffNotificationDTO[];
  unread_count:  number;
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}
