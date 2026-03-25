export interface OwnerWalletSummaryDTO {
  total_balance:        number;   
  total_escrow_held:    number;   
  lifetime_earnings:    number;   
  businesses: BusinessWalletCardDTO[];
}

export interface BusinessWalletCardDTO {
  business_id:      string;
  business_name:    string;
  logo_url:         string | null;
  balance:          number;   
  escrow_held:      number;   
  lifetime_earned:  number;   
}

export interface EscrowTransactionDTO {
  id:                   string;
  booking_id:           string;
  booking_number:       string;
  business_id:          string;
  business_name:        string;
  amount:               number;
  net_amount:           number;
  platform_fee:         number;
  status:               string;
  scheduled_release_at: Date;
  released_at:          Date | null;
  customer_name:        string;
  staff_name:           string;
  services:             string[];
}

export interface EscrowListResponseDTO {
  transactions: EscrowTransactionDTO[];
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
  };
}
