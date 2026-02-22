import * as Calendar from "expo-calendar";
import { Platform } from "react-native";

export type CalendarEvent = {
  id: string;
  title: string;
  startDate: Date;
  endDate: Date;
  calendarId: string;
  location?: string;
  notes?: string;
};

export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}

export async function getCalendarPermissionStatus(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  return status === "granted";
}

async function getDefaultCalendarIds(): Promise<string[]> {
  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );
  return calendars
    .filter((c) => c.allowsModifications || c.source?.type === "local" || Platform.OS === "ios")
    .map((c) => c.id);
}

export async function getUpcomingEvents(
  hoursAhead = 168,
): Promise<CalendarEvent[]> {
  const hasPermission = await getCalendarPermissionStatus();
  if (!hasPermission) return [];

  const calendarIds = await getDefaultCalendarIds();
  if (calendarIds.length === 0) return [];

  const now = new Date();
  const end = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const events = await Calendar.getEventsAsync(calendarIds, now, end);

  return events
    .filter((e) => e.title && e.title.trim().length > 0)
    .map((e) => ({
      id: e.id,
      title: e.title,
      startDate: new Date(e.startDate),
      endDate: new Date(e.endDate),
      calendarId: e.calendarId,
      location: e.location ?? undefined,
      notes: e.notes ?? undefined,
    }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
}

export function formatEventTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatEventDate(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function minutesUntilEvent(eventStart: Date): number {
  return Math.round(
    (eventStart.getTime() - Date.now()) / (1000 * 60),
  );
}
