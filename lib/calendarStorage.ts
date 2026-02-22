import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "tempr_calendar_recommendations";
const PROCESSED_EVENTS_KEY = "tempr_processed_event_ids";

export type CalendarRecommendation = {
  id: string;
  eventId: string;
  eventTitle: string;
  eventStartDate: number;
  eventLocation?: string;
  songs: { name: string; albumArt?: string }[];
  reasoning: string;
  createdAt: number;
};

export async function saveRecommendation(
  rec: CalendarRecommendation,
): Promise<void> {
  const existing = await loadRecommendations();
  const filtered = existing.filter((r) => r.eventId !== rec.eventId);
  filtered.unshift(rec);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function loadRecommendations(): Promise<
  CalendarRecommendation[]
> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: CalendarRecommendation[] = JSON.parse(raw);
    return parsed.sort((a, b) => b.eventStartDate - a.eventStartDate);
  } catch {
    return [];
  }
}

export async function deleteRecommendation(id: string): Promise<void> {
  const existing = await loadRecommendations();
  const filtered = existing.filter((r) => r.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function clearOldRecommendations(): Promise<void> {
  const existing = await loadRecommendations();
  const oneDayAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filtered = existing.filter((r) => r.eventStartDate > oneDayAgo);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export async function markEventProcessed(eventId: string): Promise<void> {
  const processed = await getProcessedEventIds();
  processed.add(eventId);
  const arr = Array.from(processed).slice(-200);
  await AsyncStorage.setItem(PROCESSED_EVENTS_KEY, JSON.stringify(arr));
}

export async function getProcessedEventIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(PROCESSED_EVENTS_KEY);
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set();
  }
}

export async function isEventProcessed(eventId: string): Promise<boolean> {
  const processed = await getProcessedEventIds();
  return processed.has(eventId);
}
