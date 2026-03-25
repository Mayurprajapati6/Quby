import { formatInTimeZone } from "date-fns-tz";
import type { OwnerProfile } from "./owner.types";

const IST = "Asia/Kolkata";

export function toOwnerProfile(owner: any): OwnerProfile {
  return {
    id:                owner.id,
    name:              owner.name,
    email:             owner.user?.email ?? "",
    phone:             owner.phone        ?? null,
    avatar_url:        owner.avatar_url   ?? null,
    city:              owner.city         ?? null,
    state:             owner.state        ?? null,
    address_line1:     owner.address_line1 ?? null,
    address_line2:     owner.address_line2 ?? null,
    join_date:         formatInTimeZone(owner.created_at, IST, "yyyy-MM-dd"),
    total_businesses:  owner.total_businesses  ?? 0,
    active_businesses: owner.active_businesses ?? 0,
  };
}
