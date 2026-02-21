import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import type { CalendarEvent, CalendarEventType } from "./types";

const EVENT_KEYWORDS: Record<string, CalendarEventType> = {
  date: "date_night",
  dinner: "date_night",
  romantic: "date_night",
  anniversary: "date_night",
  gym: "workout",
  workout: "workout",
  exercise: "workout",
  run: "workout",
  yoga: "workout",
  crossfit: "workout",
  training: "workout",
  study: "study",
  exam: "study",
  homework: "study",
  library: "study",
  revision: "study",
  flight: "flight",
  airport: "flight",
  travel: "flight",
  boarding: "flight",
  meeting: "meeting",
  standup: "meeting",
  sync: "meeting",
  review: "meeting",
  "1:1": "meeting",
  party: "party",
  birthday: "party",
  celebration: "party",
  hangout: "social",
  drinks: "social",
  brunch: "social",
  lunch: "social",
  coffee: "social",
  commute: "commute",
  spa: "relaxation",
  massage: "relaxation",
  meditation: "relaxation",
};

function inferEventType(title: string): CalendarEventType {
  const lower = title.toLowerCase();
  for (const [keyword, type] of Object.entries(EVENT_KEYWORDS)) {
    if (lower.includes(keyword)) return type;
  }
  return "unknown";
}

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

export async function getUpcomingEvents(
  windowMinutes = 120
): Promise<CalendarEvent | null> {
  try {
    const { status } = await Calendar.getCalendarPermissionsAsync();
    if (status !== "granted") return null;

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT
    );

    const calendarIds = calendars
      .filter((c) => c.allowsModifications || Platform.OS === "ios")
      .map((c) => c.id);

    if (calendarIds.length === 0) return null;

    const now = new Date();
    const end = new Date(now.getTime() + windowMinutes * 60 * 1000);

    const events = await Calendar.getEventsAsync(calendarIds, now, end);

    if (events.length === 0) return null;

    const sorted = events.sort(
      (a, b) =>
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );

    const next = sorted[0];
    const startsInMin = Math.round(
      (new Date(next.startDate).getTime() - now.getTime()) / 60000
    );

    return {
      type: inferEventType(next.title),
      title: next.title,
      startsInMin: Math.max(0, startsInMin),
    };
  } catch (err) {
    console.warn("[Calendar] failed:", err);
    return null;
  }
}
