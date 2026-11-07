/**
 * Dynamic date helper for ThreadFlow manufacturing operations.
 * If SIMULATED_TODAY_DATE is explicitly specified, it uses that date;
 * otherwise, it returns the live real-time system date (new Date()).
 */
export function getSystemToday(): Date {
  if (process.env.SIMULATED_TODAY_DATE && process.env.SIMULATED_TODAY_DATE.trim() !== '') {
    return new Date(process.env.SIMULATED_TODAY_DATE);
  }
  return new Date();
}
