import { getAuthoritativeServerDate } from '../services/api';

/**
 * Calculates working days remaining to Ex-Factory deadline (excluding Sundays).
 * Dynamically computed against live authoritative server/system date.
 */
export function calculateWorkingDaysLeft(
  exFactoryDate: string | Date,
  fromDate?: Date
): number {
  const from = fromDate ? new Date(fromDate) : getAuthoritativeServerDate();
  const to = new Date(exFactoryDate);

  // Normalize to calendar day boundary
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const target = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  if (target <= cur) return 0;

  let count = 0;
  while (cur < target) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getDay() !== 0) {
      count++;
    }
  }
  return count;
}

/**
 * Computes ISO calendar week number (CW) for any given date.
 */
export function getIsoShipWeek(dateInput: string | Date): number {
  const d = new Date(dateInput);
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}
