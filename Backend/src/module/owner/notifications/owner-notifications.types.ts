export interface OwnerNotificationDTO {
  id:            string;
  type:          string;
  title:         string;
  message:       string;
  business_id:   string;
  business_name: string;
  data:          Record<string, any> | null;
  action_url:    string | null;
  is_read:       boolean;
  read_at:       Date | null;
  created_at:    Date;
}

export interface OwnerNotificationsResponseDTO {
  notifications: OwnerNotificationDTO[];
  unread_count:  number;
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}
