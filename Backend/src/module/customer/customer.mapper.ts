import { formatInTimeZone } from "date-fns-tz";
import type { CustomerProfile } from "./customer.types";

const IST = "Asia/Kolkata";

function generateRandomAvatar(seed: string): string {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

function toIST(date: Date | null | undefined): string | null {
  if (!date) return null;
  return formatInTimeZone(date, IST, "yyyy-MM-dd'T'HH:mm:ssxxx");
}

type CustomerRow = {
  id:              string;
  username:        string;
  name:            string;
  phone:           string | null;
  avatar_url:      string | null;
  gender:          string | null;
  city:            string;
  state:           string;
  country:         string;
  address_line1:   string | null;
  address_line2:   string | null;
  first_login_at:  Date | null;
  total_bookings:     number;
  completed_bookings: number;
  cancelled_bookings: number;
  total_spent:        number;
  created_at:      Date;
  user: {
    email:         string;
    last_login_at: Date | null;
  };
};

export function toCustomerProfile(customer: CustomerRow): CustomerProfile {
  return {
    id:            customer.id,
    username:      customer.username,
    name:          customer.name,
    email:         customer.user.email,
    phone:         customer.phone,

    avatar_url:    customer.avatar_url ?? generateRandomAvatar(customer.username),

    gender:        customer.gender,
    city:          customer.city,
    state:         customer.state,
    country:       customer.country,
    address_line1: customer.address_line1,
    address_line2: customer.address_line2,

    join_date:      toIST(customer.created_at)!,
    first_login_at: toIST(customer.first_login_at),
    last_login_at:  toIST(customer.user.last_login_at),

    total_bookings:     customer.total_bookings,
    completed_bookings: customer.completed_bookings,
    cancelled_bookings: customer.cancelled_bookings,
    total_spent:        customer.total_spent,
  };
}
