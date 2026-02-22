import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { getUpcomingEvents, type CalendarEvent } from "./calendar";
import {
  isEventProcessed,
  markEventProcessed,
  saveRecommendation,
  type CalendarRecommendation,
} from "./calendarStorage";
import { generateEventPlaylist } from "./gemini";
import type { SpotifyTrack } from "./spotify";
import { batchedSearch, getLikedTracks } from "./spotify";

const LIKED_CACHE_KEY = "tempr_calendar_liked_cache";
const LIKED_CACHE_TTL = 30 * 60 * 1000;
const NOTIFICATION_PREFIX = "tempr-cal-";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function getNotificationPermissionStatus(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

async function getCachedLikedTracks(
  spotifyToken: string,
): Promise<SpotifyTrack[]> {
  try {
    const raw = await AsyncStorage.getItem(LIKED_CACHE_KEY);
    if (raw) {
      const { tracks, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp < LIKED_CACHE_TTL) return tracks;
    }
  } catch {}

  const tracks = await getLikedTracks(spotifyToken, 500);
  await AsyncStorage.setItem(
    LIKED_CACHE_KEY,
    JSON.stringify({ tracks, timestamp: Date.now() }),
  );
  return tracks;
}

async function fetchAlbumArt(
  songNames: string[],
  spotifyToken: string,
): Promise<Map<string, string>> {
  const artMap = new Map<string, string>();
  try {
    const results = await batchedSearch(spotifyToken, songNames, 3);
    for (let i = 0; i < songNames.length; i++) {
      const tracks = results[i];
      if (tracks?.[0]?.album?.images?.[0]?.url) {
        artMap.set(songNames[i], tracks[0].album.images[0].url);
      }
    }
  } catch {}
  return artMap;
}

export async function generateAndScheduleForEvent(
  event: CalendarEvent,
  spotifyToken: string,
): Promise<CalendarRecommendation | null> {
  const already = await isEventProcessed(event.id);
  if (already) return null;

  try {
    const likedTracks = await getCachedLikedTracks(spotifyToken);
    if (likedTracks.length === 0) return null;

    const suggestion = await generateEventPlaylist(
      event.title,
      event.location,
      likedTracks,
    );

    const songNames = suggestion.familiar;
    const artMap = await fetchAlbumArt(songNames, spotifyToken);

    const rec: CalendarRecommendation = {
      id: `cal-${event.id}-${Date.now()}`,
      eventId: event.id,
      eventTitle: event.title,
      eventStartDate: event.startDate.getTime(),
      eventLocation: event.location,
      songs: songNames.map((name) => ({
        name,
        albumArt: artMap.get(name),
      })),
      reasoning: suggestion.reasoning,
      createdAt: Date.now(),
    };

    await saveRecommendation(rec);
    await markEventProcessed(event.id);

    await scheduleNotification(event, songNames.length);

    return rec;
  } catch (err) {
    console.error("[CalendarNotif] Failed to generate for event:", event.title, err);
    return null;
  }
}

async function scheduleNotification(
  event: CalendarEvent,
  trackCount: number,
): Promise<void> {
  const triggerTime = new Date(
    event.startDate.getTime() - 10 * 60 * 1000,
  );

  if (triggerTime.getTime() <= Date.now()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Playlist ready for "${event.title}"`,
        body: `${trackCount} tracks curated for your upcoming event. Tap to view.`,
        data: { eventId: event.id, type: "calendar_recommendation" },
        sound: true,
      },
      trigger: null,
    });
    return;
  }

  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTIFICATION_PREFIX}${event.id}`,
    content: {
      title: `Playlist ready for "${event.title}"`,
      body: `${trackCount} tracks curated for your event starting in 10 minutes.`,
      data: { eventId: event.id, type: "calendar_recommendation" },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerTime,
    },
  });
}

export async function scanAndScheduleUpcomingEvents(
  spotifyToken: string,
): Promise<number> {
  const events = await getUpcomingEvents(24);
  let scheduled = 0;

  for (const event of events) {
    const minsUntil =
      (event.startDate.getTime() - Date.now()) / (1000 * 60);

    if (minsUntil < 0) continue;

    const result = await generateAndScheduleForEvent(event, spotifyToken);
    if (result) scheduled++;
  }

  return scheduled;
}

export async function cancelAllCalendarNotifications(): Promise<void> {
  const scheduled =
    await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.identifier.startsWith(NOTIFICATION_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(
        notif.identifier,
      );
    }
  }
}
