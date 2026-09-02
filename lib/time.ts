/** Date helpers shared by queue and schedule projections. */
export function asOfDate(input: Date | string = new Date()) {
  const date = typeof input === "string" ? new Date(input) : input;
  const safeDate = Number.isNaN(date.valueOf()) ? new Date() : date;
  return safeDate.toISOString().slice(0, 10);
}

export function asOfDateTime(input?: Date | string) {
  return new Date(`${asOfDate(input ?? new Date())}T12:00:00Z`);
}
