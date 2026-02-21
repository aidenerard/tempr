import type { TimeBucket } from "./types";

export function getTimeBucket(date: Date = new Date()): TimeBucket {
  const h = date.getHours();
  if (h >= 5 && h < 8) return "early_morning";
  if (h >= 8 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "late_night";
}

export function isQuietHours(
  start: number,
  end: number,
  date: Date = new Date()
): boolean {
  const h = date.getHours();
  if (start > end) {
    return h >= start || h < end;
  }
  return h >= start && h < end;
}
