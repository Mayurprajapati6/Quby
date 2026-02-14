import { format, add, parse, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';

export function formatDate(date: Date): string {
  return format(date, 'dd MMM yyyy');
}

export function formatTime(date: Date): string {
  return format(date, 'hh:mm a');
}

export function formatDateTime(date: Date): string {
  return format(date, 'dd MMM yyyy, hh:mm a');
}

export function addMinutes(date: Date, minutes: number): Date {
  return add(date, { minutes });
}

export function addDays(date: Date, days: number): Date {
  return add(date, { days });
}

export function parseTime(timeString: string, referenceDate: Date): Date {
  return parse(timeString, 'HH:mm', referenceDate);
}

export function isDateAfter(date1: Date, date2: Date): boolean {
  return isAfter(date1, date2);
}

export function isDateBefore(date1: Date, date2: Date): boolean {
  return isBefore(date1, date2);
}

export function getStartOfDay(date: Date): Date {
  return startOfDay(date);
}

export function getEndOfDay(date: Date): Date {
  return endOfDay(date);
}