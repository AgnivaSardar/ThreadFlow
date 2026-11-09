/**
 * Dynamic date helper for ThreadFlow manufacturing operations.
 * If SIMULATED_TODAY_DATE is explicitly specified, it uses that date;
 * however, if the live system date has advanced past an outdated simulated anchor,
 * it returns the live date to prevent hiding current manufacturing updates in the "future".
 */
export function getSystemToday(): Date {
  if (process.env.SIMULATED_TODAY_DATE && process.env.SIMULATED_TODAY_DATE.trim() !== '') {
    const envDate = new Date(process.env.SIMULATED_TODAY_DATE);
    const systemNow = new Date();
    if (!isNaN(envDate.getTime())) {
      if (systemNow.getTime() > envDate.getTime()) {
        return systemNow;
      }
      return envDate;
    }
  }
  return new Date();
}

const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const TAMIL_MONTHS = ['ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'];

export interface ISOWeekInfo {
  year: number;
  weekNumber: number;
  weekKey: string; // e.g. "CW45"
}

export interface ISOWeekRange {
  start: Date;
  end: Date;
  label: string; // e.g. "Calendar Week 45 (Nov 02 - Nov 08)"
  labelTa: string; // e.g. "காலண்டர் வாரம் 45 (நவ 02 - நவ 08)"
  shortLabel: string; // e.g. "CW 45"
}

export interface AvailableWeek {
  value: string; // "CW45"
  weekNumber: number;
  year: number;
  label: string;
  labelTa: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

/**
 * Calculates standard ISO-8601 calendar week and year for a given date in UTC.
 */
export function getISOWeekInfo(dateInput: Date = getSystemToday()): ISOWeekInfo {
  const d = new Date(Date.UTC(dateInput.getUTCFullYear(), dateInput.getUTCMonth(), dateInput.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const year = d.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const weekNumber = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return {
    year,
    weekNumber,
    weekKey: `CW${weekNumber}`,
  };
}

/**
 * Calculates the exact start (Monday 00:00:00.000Z) and end (Sunday 23:59:59.999Z)
 * for any given ISO year and week number.
 */
export function getISOWeekRange(year: number, weekNumber: number): ISOWeekRange {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = jan4.getUTCDay() || 7;
  const week1Monday = new Date(jan4.getTime() - (dayOfWeek - 1) * 86400000);
  const targetMonday = new Date(week1Monday.getTime() + (weekNumber - 1) * 7 * 86400000);
  const targetSunday = new Date(targetMonday.getTime() + 6 * 86400000 + (24 * 3600 * 1000 - 1));

  const startStr = `${EN_MONTHS[targetMonday.getUTCMonth()]} ${String(targetMonday.getUTCDate()).padStart(2, '0')}`;
  const endStr = `${EN_MONTHS[targetSunday.getUTCMonth()]} ${String(targetSunday.getUTCDate()).padStart(2, '0')}`;
  const startStrTa = `${TAMIL_MONTHS[targetMonday.getUTCMonth()]} ${String(targetMonday.getUTCDate()).padStart(2, '0')}`;
  const endStrTa = `${TAMIL_MONTHS[targetSunday.getUTCMonth()]} ${String(targetSunday.getUTCDate()).padStart(2, '0')}`;

  return {
    start: targetMonday,
    end: targetSunday,
    label: `Calendar Week ${weekNumber} (${startStr} - ${endStr})`,
    labelTa: `காலண்டர் வாரம் ${weekNumber} (${startStrTa} - ${endStrTa})`,
    shortLabel: `CW ${weekNumber}`,
  };
}

/**
 * Safely parses any week query parameter into valid ISO week number and year.
 */
export function parseWeekParam(weekParam?: string, fallbackDate: Date = getSystemToday()): ISOWeekInfo {
  if (weekParam && typeof weekParam === 'string' && weekParam.trim()) {
    const clean = weekParam.trim().toUpperCase();
    const matchWithYear = clean.match(/CW\s*(\d{1,2})[-_](\d{4})/i) || clean.match(/(\d{4})[-_]W?(\d{1,2})/i);
    if (matchWithYear) {
      const isYearFirst = matchWithYear[1].length === 4;
      const year = parseInt(isYearFirst ? matchWithYear[1] : matchWithYear[2], 10);
      const weekNumber = parseInt(isYearFirst ? matchWithYear[2] : matchWithYear[1], 10);
      if (weekNumber >= 1 && weekNumber <= 53 && year >= 2020 && year <= 2050) {
        return { year, weekNumber, weekKey: `CW${weekNumber}` };
      }
    }

    const simpleMatch = clean.match(/(?:CW\s*)?(\d{1,2})/i);
    if (simpleMatch) {
      const weekNumber = parseInt(simpleMatch[1], 10);
      if (weekNumber >= 1 && weekNumber <= 53) {
        const fallbackInfo = getISOWeekInfo(fallbackDate);
        return { year: fallbackInfo.year, weekNumber, weekKey: `CW${weekNumber}` };
      }
    }
  }

  return getISOWeekInfo(fallbackDate);
}

/**
 * Dynamically computes active calendar weeks for a particular company starting from
 * when they registered (or their earliest milestone/order), up to current week (and active orders).
 */
export function getAvailableWeeksForBuyer(
  buyer: {
    createdAt: Date;
    orders?: Array<{
      createdAt: Date;
      exFactoryDate: Date;
      milestones?: Array<{ plannedStart?: Date | null; plannedEnd?: Date | null }>;
    }>;
  }
): AvailableWeek[] {
  const systemToday = getSystemToday();
  const currentWeekInfo = getISOWeekInfo(systemToday);

  // Collect all milestone and order dates to establish exact operational boundaries
  const dateTimestamps: number[] = [buyer.createdAt.getTime()];

  if (buyer.orders && buyer.orders.length > 0) {
    for (const order of buyer.orders) {
      dateTimestamps.push(new Date(order.createdAt).getTime());
      dateTimestamps.push(new Date(order.exFactoryDate).getTime());
      if (order.milestones) {
        for (const m of order.milestones) {
          if (m.plannedStart) dateTimestamps.push(new Date(m.plannedStart).getTime());
          if (m.plannedEnd) dateTimestamps.push(new Date(m.plannedEnd).getTime());
        }
      }
    }
  }

  const minTimestamp = Math.min(...dateTimestamps);
  // Ensure we cover at least 4 weeks prior to system today for velocity chart baseline
  const baselineHistoricalTimestamp = systemToday.getTime() - 4 * 7 * 86400000;
  const startTimestamp = Math.min(minTimestamp, baselineHistoricalTimestamp);

  // Upper boundary: latest active order or current week
  const maxTimestamp = Math.max(systemToday.getTime(), ...dateTimestamps);

  const startWeekInfo = getISOWeekInfo(new Date(startTimestamp));
  const endWeekInfo = getISOWeekInfo(new Date(maxTimestamp));

  const startRange = getISOWeekRange(startWeekInfo.year, startWeekInfo.weekNumber);
  const endRange = getISOWeekRange(endWeekInfo.year, endWeekInfo.weekNumber);

  const availableWeeks: AvailableWeek[] = [];
  const visitedKeys = new Set<string>();

  // Iterate backwards from endRange to startRange (descending)
  let cursorTime = endRange.end.getTime();
  const lowerBoundTime = startRange.start.getTime();

  while (cursorTime >= lowerBoundTime) {
    const weekDate = new Date(cursorTime);
    const info = getISOWeekInfo(weekDate);
    const uniqueKey = `${info.year}-${info.weekNumber}`;

    if (!visitedKeys.has(uniqueKey)) {
      visitedKeys.add(uniqueKey);
      const range = getISOWeekRange(info.year, info.weekNumber);
      const isCurrent = info.year === currentWeekInfo.year && info.weekNumber === currentWeekInfo.weekNumber;

      availableWeeks.push({
        value: info.weekKey,
        weekNumber: info.weekNumber,
        year: info.year,
        label: range.label,
        labelTa: range.labelTa,
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        isCurrent,
      });
    }

    // Step back 7 days
    cursorTime -= 7 * 86400000;
  }

  // Ensure at least 5 weeks are always present for clean historical trend rendering
  if (availableWeeks.length < 5) {
    let lastWeekTime = cursorTime;
    while (availableWeeks.length < 5) {
      const weekDate = new Date(lastWeekTime);
      const info = getISOWeekInfo(weekDate);
      const range = getISOWeekRange(info.year, info.weekNumber);
      availableWeeks.push({
        value: info.weekKey,
        weekNumber: info.weekNumber,
        year: info.year,
        label: range.label,
        labelTa: range.labelTa,
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        isCurrent: false,
      });
      lastWeekTime -= 7 * 86400000;
    }
  }

  return availableWeeks;
}
