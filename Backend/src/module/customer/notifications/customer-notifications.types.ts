export interface CustomerNotificationDTO {
  id:         string;
  type:       string;
  title:      string;
  message:    string;
  is_read:    boolean;
  read_at:    Date | null;
  created_at: Date;
  data:       Record<string, any> | null;
}

export interface CustomerNotificationsResponseDTO {
  notifications: CustomerNotificationDTO[];
  unread_count:  number;
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}
