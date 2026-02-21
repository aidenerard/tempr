export type LocationType =
  | "home"
  | "work"
  | "gym"
  | "library"
  | "airport"
  | "cafe"
  | "restaurant"
  | "bar"
  | "park"
  | "transit"
  | "new_city"
  | "unknown";

export type WeatherTag =
  | "rain"
  | "drizzle"
  | "storm"
  | "snow"
  | "clear"
  | "cloudy"
  | "hot"
  | "cold"
  | "windy"
  | "foggy"
  | "unknown";

export type TimeBucket =
  | "early_morning"
  | "morning"
  | "afternoon"
  | "evening"
  | "late_night";

export type CalendarEventType =
  | "date_night"
  | "workout"
  | "study"
  | "flight"
  | "meeting"
  | "party"
  | "commute"
  | "social"
  | "relaxation"
  | "unknown";

export type CalendarEvent = {
  type: CalendarEventType;
  title: string;
  startsInMin: number;
};

export type ContextPayload = {
  locationType: LocationType;
  weatherTag: WeatherTag;
  weatherDescription: string;
  temperature: number | null;
  timeBucket: TimeBucket;
  upcomingEvent: CalendarEvent | null;
  timestamp: number;
};

export type ContextPermissions = {
  location: boolean;
  calendar: boolean;
  notifications: boolean;
  weather: boolean;
  timeOfDay: boolean;
};

export type PromptSettings = {
  weatherPrompts: boolean;
  calendarPrompts: boolean;
  locationPrompts: boolean;
  timeOfDayPrompts: boolean;
  quietHoursStart: number;
  quietHoursEnd: number;
  maxPromptsPerDay: number;
};

export const DEFAULT_PROMPT_SETTINGS: PromptSettings = {
  weatherPrompts: true,
  calendarPrompts: true,
  locationPrompts: true,
  timeOfDayPrompts: true,
  quietHoursStart: 23,
  quietHoursEnd: 7,
  maxPromptsPerDay: 3,
};
