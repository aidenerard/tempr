export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    queueId?: string;
    [key: string]: unknown;
  };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { id: string; name: string }[];
  album: { name: string; images: { url: string }[] };
  preview_url: string | null;
  duration_ms: number;
  durationMs: number;
  uri: string;
}

export interface MoodProfile {
  valence: number;
  energy: number;
  tempo: number;
  danceability: number;
  acousticness?: number;
  tags?: string[];
  source: 'context' | 'video' | 'user-chat' | 'user-prompted' | 'app-prompted';
}

export interface WeatherData {
  condition: string;
  temperature: number;
  humidity?: number;
}

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
}

export interface ContextSignals {
  weather?: WeatherData;
  calendarEvents?: CalendarEvent[];
  timeOfDay: string;
  location?: { lat: number; lon: number };
}

export interface VideoAnalysis {
  moodTags?: string[];
  dominantMood: string;
}

export interface GeneratedQueue {
  id: string;
  tracks: SpotifyTrack[];
  moodProfile: MoodProfile;
  createdAt: string;
  source: string;
  context?: ContextSignals;
  totalDurationMs: number;
  title: string;
  description?: string;
}
