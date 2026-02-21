/**
 * Google Calendar API service
 * Fetches upcoming events for contextual queue generation
 * Cache responses server-side via Supabase edge functions to avoid rate limits
 */

export interface CalendarEvent {
  id: string;
  summary: string;
  start: Date;
  end: Date;
  location?: string;
}

/**
 * Fetch upcoming events from Google Calendar
 * Requires OAuth token with calendar scope
 */
export async function getUpcomingEvents(
  accessToken: string,
  maxResults = 10,
  timeMin?: Date
): Promise<CalendarEvent[]> {
  const min = timeMin ?? new Date();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `singleEvents=true&orderBy=startTime&maxResults=${maxResults}&` +
      `timeMin=${min.toISOString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) throw new Error(`Google Calendar API error: ${res.status}`);
  const data = await res.json();
  return (data.items ?? []).map((e: Record<string, unknown>) => ({
    id: e.id,
    summary: e.summary ?? "",
    start: new Date((e.start as { dateTime?: string })?.dateTime ?? ""),
    end: new Date((e.end as { dateTime?: string })?.dateTime ?? ""),
    location: (e.location as string) ?? undefined,
  }));
}

/**
 * Derive mood/vibe from calendar event summary
 * Used for app-prompted notifications (e.g. "date night", "gym")
 */
export function eventToMood(summary: string): {
  valence: number;
  energy: number;
  description: string;
} | null {
  const s = summary.toLowerCase();
  if (
    s.includes("date") ||
    s.includes("romantic") ||
    s.includes("dinner") ||
    s.includes("anniversary")
  ) {
    return { valence: 0.8, energy: 0.5, description: "romantic" };
  }
  if (
    s.includes("gym") ||
    s.includes("workout") ||
    s.includes("run") ||
    s.includes("exercise")
  ) {
    return { valence: 0.7, energy: 0.9, description: "workout upbeat" };
  }
  if (
    s.includes("flight") ||
    s.includes("airport") ||
    s.includes("travel")
  ) {
    return { valence: 0.6, energy: 0.4, description: "travel chill" };
  }
  if (s.includes("focus") || s.includes("study") || s.includes("library")) {
    return { valence: 0.5, energy: 0.3, description: "focus ambient" };
  }
  if (s.includes("party") || s.includes("celebration")) {
    return { valence: 0.9, energy: 0.95, description: "party high energy" };
  }
  return null;
}
