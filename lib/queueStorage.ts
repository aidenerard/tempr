import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "tempr_saved_queues";

export type SavedQueue = {
  id: string;
  prompt: string;
  moodLine: string;
  songs: { name: string; albumArt?: string }[];
  savedAt: number;
};

export async function saveQueue(queue: SavedQueue): Promise<void> {
  const existing = await loadQueues();
  existing.unshift(queue);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export async function loadQueues(): Promise<SavedQueue[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: SavedQueue[] = JSON.parse(raw);
    return parsed.sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

export async function deleteQueue(id: string): Promise<void> {
  const existing = await loadQueues();
  const filtered = existing.filter((q) => q.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}
