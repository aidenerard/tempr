import type { AudioFeatureTargets } from "./gemini";
import type {
  ContextPayload,
  WeatherTag,
  TimeBucket,
  CalendarEventType,
  LocationType,
} from "./context/types";

export type VibeId =
  | "rainy_chill"
  | "storm_intense"
  | "snow_cozy"
  | "romantic_warm"
  | "gym_hype"
  | "focus_study"
  | "travel_smooth"
  | "morning_gentle"
  | "afternoon_cruise"
  | "night_winddown"
  | "late_night_deep"
  | "party_energy"
  | "cafe_acoustic"
  | "park_sunny"
  | "commute_flow";

export type VibeProfile = {
  id: VibeId;
  label: string;
  emoji: string;
  description: string;
  audioFeatures: AudioFeatureTargets;
  targetDurationMin: number;
};

export const VIBE_PROFILES: Record<VibeId, VibeProfile> = {
  rainy_chill: {
    id: "rainy_chill",
    label: "Rainy Day",
    emoji: "☔",
    description: "Mellow, ambient tracks for a rainy day",
    audioFeatures: {
      energy: 0.3,
      valence: 0.35,
      danceability: 0.4,
      acousticness: 0.6,
      tempo: 95,
    },
    targetDurationMin: 45,
  },
  storm_intense: {
    id: "storm_intense",
    label: "Storm Mode",
    emoji: "⛈️",
    description: "Dark, atmospheric tracks for stormy weather",
    audioFeatures: {
      energy: 0.5,
      valence: 0.25,
      danceability: 0.35,
      acousticness: 0.3,
      tempo: 105,
    },
    targetDurationMin: 40,
  },
  snow_cozy: {
    id: "snow_cozy",
    label: "Snowy & Cozy",
    emoji: "❄️",
    description: "Warm, intimate tracks for a snowy day",
    audioFeatures: {
      energy: 0.25,
      valence: 0.45,
      danceability: 0.3,
      acousticness: 0.7,
      tempo: 85,
    },
    targetDurationMin: 50,
  },
  romantic_warm: {
    id: "romantic_warm",
    label: "Romantic",
    emoji: "💫",
    description: "Smooth, warm tracks for a date night",
    audioFeatures: {
      energy: 0.4,
      valence: 0.55,
      danceability: 0.5,
      acousticness: 0.45,
      tempo: 100,
    },
    targetDurationMin: 30,
  },
  gym_hype: {
    id: "gym_hype",
    label: "Gym Hype",
    emoji: "💪",
    description: "High-energy bangers for a workout",
    audioFeatures: {
      energy: 0.85,
      valence: 0.6,
      danceability: 0.7,
      acousticness: 0.05,
      tempo: 135,
    },
    targetDurationMin: 45,
  },
  focus_study: {
    id: "focus_study",
    label: "Focus Mode",
    emoji: "📚",
    description: "Minimal, ambient tracks for deep focus",
    audioFeatures: {
      energy: 0.2,
      valence: 0.35,
      danceability: 0.25,
      acousticness: 0.5,
      tempo: 80,
    },
    targetDurationMin: 60,
  },
  travel_smooth: {
    id: "travel_smooth",
    label: "Travel Mode",
    emoji: "✈️",
    description: "Smooth, upbeat tracks for traveling",
    audioFeatures: {
      energy: 0.5,
      valence: 0.55,
      danceability: 0.55,
      acousticness: 0.3,
      tempo: 110,
    },
    targetDurationMin: 60,
  },
  morning_gentle: {
    id: "morning_gentle",
    label: "Good Morning",
    emoji: "🌅",
    description: "Gentle, uplifting tracks to start the day",
    audioFeatures: {
      energy: 0.35,
      valence: 0.6,
      danceability: 0.45,
      acousticness: 0.55,
      tempo: 100,
    },
    targetDurationMin: 30,
  },
  afternoon_cruise: {
    id: "afternoon_cruise",
    label: "Afternoon Cruise",
    emoji: "☀️",
    description: "Easy-going, feel-good tracks for the afternoon",
    audioFeatures: {
      energy: 0.55,
      valence: 0.65,
      danceability: 0.6,
      acousticness: 0.3,
      tempo: 112,
    },
    targetDurationMin: 40,
  },
  night_winddown: {
    id: "night_winddown",
    label: "Wind Down",
    emoji: "🌙",
    description: "Calm, soothing tracks to wind down the evening",
    audioFeatures: {
      energy: 0.25,
      valence: 0.4,
      danceability: 0.35,
      acousticness: 0.6,
      tempo: 85,
    },
    targetDurationMin: 40,
  },
  late_night_deep: {
    id: "late_night_deep",
    label: "Late Night",
    emoji: "🌌",
    description: "Deep, introspective tracks for the late hours",
    audioFeatures: {
      energy: 0.2,
      valence: 0.3,
      danceability: 0.3,
      acousticness: 0.45,
      tempo: 78,
    },
    targetDurationMin: 45,
  },
  party_energy: {
    id: "party_energy",
    label: "Party Time",
    emoji: "🎉",
    description: "High-energy party tracks to get the vibe going",
    audioFeatures: {
      energy: 0.8,
      valence: 0.75,
      danceability: 0.8,
      acousticness: 0.05,
      tempo: 125,
    },
    targetDurationMin: 60,
  },
  cafe_acoustic: {
    id: "cafe_acoustic",
    label: "Cafe Vibes",
    emoji: "☕",
    description: "Acoustic, laid-back tracks for a cafe session",
    audioFeatures: {
      energy: 0.3,
      valence: 0.5,
      danceability: 0.4,
      acousticness: 0.7,
      tempo: 95,
    },
    targetDurationMin: 45,
  },
  park_sunny: {
    id: "park_sunny",
    label: "Sunny Park",
    emoji: "🌳",
    description: "Bright, cheerful tracks for outdoor vibes",
    audioFeatures: {
      energy: 0.5,
      valence: 0.7,
      danceability: 0.55,
      acousticness: 0.4,
      tempo: 108,
    },
    targetDurationMin: 40,
  },
  commute_flow: {
    id: "commute_flow",
    label: "Commute Flow",
    emoji: "🚶",
    description: "Steady, rhythmic tracks for getting around",
    audioFeatures: {
      energy: 0.55,
      valence: 0.5,
      danceability: 0.6,
      acousticness: 0.2,
      tempo: 115,
    },
    targetDurationMin: 30,
  },
};

const WEATHER_VIBE_MAP: Partial<Record<WeatherTag, VibeId>> = {
  rain: "rainy_chill",
  drizzle: "rainy_chill",
  storm: "storm_intense",
  snow: "snow_cozy",
  clear: "park_sunny",
  hot: "afternoon_cruise",
  cold: "snow_cozy",
  foggy: "rainy_chill",
};

const TIME_VIBE_MAP: Record<TimeBucket, VibeId> = {
  early_morning: "morning_gentle",
  morning: "morning_gentle",
  afternoon: "afternoon_cruise",
  evening: "night_winddown",
  late_night: "late_night_deep",
};

const CALENDAR_VIBE_MAP: Partial<Record<CalendarEventType, VibeId>> = {
  date_night: "romantic_warm",
  workout: "gym_hype",
  study: "focus_study",
  flight: "travel_smooth",
  party: "party_energy",
  social: "afternoon_cruise",
  relaxation: "night_winddown",
};

const LOCATION_VIBE_MAP: Partial<Record<LocationType, VibeId>> = {
  gym: "gym_hype",
  library: "focus_study",
  airport: "travel_smooth",
  cafe: "cafe_acoustic",
  bar: "party_energy",
  park: "park_sunny",
  transit: "commute_flow",
  restaurant: "romantic_warm",
};

/**
 * Priority: calendar-imminent > location > weather > time-of-day.
 * Returns the best matching vibe for the given context.
 */
export function inferVibe(context: ContextPayload): VibeProfile {
  if (context.upcomingEvent && context.upcomingEvent.startsInMin <= 60) {
    const calendarVibe = CALENDAR_VIBE_MAP[context.upcomingEvent.type];
    if (calendarVibe) return VIBE_PROFILES[calendarVibe];
  }

  if (context.locationType !== "unknown") {
    const locationVibe = LOCATION_VIBE_MAP[context.locationType];
    if (locationVibe) return VIBE_PROFILES[locationVibe];
  }

  if (context.weatherTag !== "unknown" && context.weatherTag !== "clear") {
    const weatherVibe = WEATHER_VIBE_MAP[context.weatherTag];
    if (weatherVibe) return VIBE_PROFILES[weatherVibe];
  }

  return VIBE_PROFILES[TIME_VIBE_MAP[context.timeBucket]];
}

export function getVibePromptDescription(
  vibe: VibeProfile,
  context: ContextPayload
): string {
  const parts: string[] = [vibe.description];

  if (context.upcomingEvent && context.upcomingEvent.startsInMin <= 60) {
    parts.push(
      `Upcoming event: "${context.upcomingEvent.title}" in ${context.upcomingEvent.startsInMin} minutes.`
    );
  }

  if (context.weatherTag !== "unknown") {
    parts.push(`Weather: ${context.weatherDescription || context.weatherTag}.`);
  }

  parts.push(`Time: ${context.timeBucket.replace("_", " ")}.`);

  return parts.join(" ");
}
