export function floorToMinute(date: Date): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

export function ceilToMinute(date: Date): Date {
  const d = floorToMinute(date);
  if (d.getTime() < date.getTime()) d.setMinutes(d.getMinutes() + 1);
  return d;
}

export function bookingWindowStart(serviceStart: Date): Date {
  return floorToMinute(serviceStart);
}

export function deriveArrivalWindowStart(serviceStart: Date): Date {
  return new Date(bookingWindowStart(serviceStart).getTime() - 15 * 60_000);
}

export function deriveArrivalWindowEnd(serviceStart: Date): Date {
  return bookingWindowStart(serviceStart);
}

export function deriveScanWindowEnd(serviceStart: Date): Date {
  return new Date(bookingWindowStart(serviceStart).getTime() + 10 * 60_000);
}

export function deriveServiceEnd(serviceStart: Date, durationMinutes: number): Date {
  return new Date(bookingWindowStart(serviceStart).getTime() + durationMinutes * 60_000);
}
