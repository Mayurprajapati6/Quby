export interface CustomerWalletDTO {
  id:               string;
  balance:          number;   
  currency:         string;
  lifetime_spent:   number;   
  lifetime_refunds: number;   
  total_bookings:     number;
  completed_bookings: number;
  total_spent_inr:    number; 
}

export interface CustomerWalletTransactionDTO {
  id:            string;
  type:          "BOOKING_PAYMENT" | "REFUND" | "CREDIT";
  amount:        number;   
  balance_after: number;   
  description:   string;
  booking_id:    string | null;
  created_at:    Date;
  booking?: {
    booking_number: string;
    business_name:  string;
  } | null;
}

export interface CustomerWalletTransactionsResponseDTO {
  wallet:       CustomerWalletDTO;
  transactions: CustomerWalletTransactionDTO[];
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}
