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
