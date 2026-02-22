import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "tempr_saved_queues";

export type SavedQueue = {
  id: string;
  prompt: string;
  moodLine: string;
  title: string;
  coverImage?: string;
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

export async function queueExists(id: string): Promise<boolean> {
  const queues = await loadQueues();
  return queues.some((q) => q.id === id);
}

export async function getSavedIds(): Promise<Set<string>> {
  const queues = await loadQueues();
  return new Set(queues.map((q) => q.id));
}

const LIKES_KEY = "tempr_likes_songs";
const LIKES_ID = "__likes__";

export async function addToLikes(track: {
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
}): Promise<void> {
  const raw = await AsyncStorage.getItem(LIKES_KEY);
  const songs: { name: string; albumArt?: string }[] = raw
    ? JSON.parse(raw)
    : [];

  const songName = `${track.name} - ${track.artists[0]?.name ?? ""}`;
  if (songs.some((s) => s.name === songName)) return;

  const albumArt = track.album.images[track.album.images.length - 1]?.url;
  songs.unshift({ name: songName, albumArt });
  await AsyncStorage.setItem(LIKES_KEY, JSON.stringify(songs));
}

export async function loadLikes(): Promise<SavedQueue | null> {
  const raw = await AsyncStorage.getItem(LIKES_KEY);
  if (!raw) return null;
  try {
    const songs: { name: string; albumArt?: string }[] = JSON.parse(raw);
    if (songs.length === 0) return null;
    return {
      id: LIKES_ID,
      prompt: "",
      moodLine: "",
      title: "Likes",
      songs,
      savedAt: 0,
    };
  } catch {
    return null;
  }
}

const TEMPR_LIKES_PLAYLIST_KEY = "tempr_likes_playlist_id";

export async function saveLikesPlaylistId(id: string): Promise<void> {
  await AsyncStorage.setItem(TEMPR_LIKES_PLAYLIST_KEY, id);
}

export async function loadLikesPlaylistId(): Promise<string | null> {
  return AsyncStorage.getItem(TEMPR_LIKES_PLAYLIST_KEY);
}

const PREVIEW_KEY = "tempr_preview_playlist";

// Stores the full SpotifyTrack[] for the most recently generated playlist
export async function savePreviewPlaylist(tracks: any[]): Promise<void> {
  await AsyncStorage.setItem(PREVIEW_KEY, JSON.stringify(tracks));
}

export async function loadPreviewPlaylist(): Promise<any[]> {
  const raw = await AsyncStorage.getItem(PREVIEW_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
