import type { TimeBand } from '../types';

export function getTimeBand(date: Date): TimeBand {
  const hour = date.getHours();

  if (hour < 9) return 'early';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function dateFromKey(dateKey: string): Date {
  if (!dateKey) return new Date();
  const parsed = new Date(`${dateKey}T12:00:00`);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function addDays(date: Date, days: number): Date {
  const copyDate = new Date(date);
  copyDate.setDate(copyDate.getDate() + days);
  return copyDate;
}

export function startOfWeek(date: Date): Date {
  const copyDate = new Date(date);
  copyDate.setHours(0, 0, 0, 0);
  const day = copyDate.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  copyDate.setDate(copyDate.getDate() + mondayOffset);
  return copyDate;
}

export function buildDateRange(start: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, index) => addDays(start, index));
}

export function buildRecentWeeksRange(referenceDate: Date, weekCount: number): Date[] {
  return buildDateRange(addDays(startOfWeek(referenceDate), -(weekCount - 1) * 7), weekCount * 7);
}
