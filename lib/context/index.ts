import { getTimeBucket } from "./time";
import { getWeather } from "./weather";
import { getUpcomingEvents } from "./calendar";
import { getCurrentCoords, classifyLocation } from "./location";
import type { ContextPayload } from "./types";

export { requestLocationPermission } from "./location";
export { requestCalendarPermission } from "./calendar";
export type { ContextPayload, PromptSettings, ContextPermissions } from "./types";
export { DEFAULT_PROMPT_SETTINGS } from "./types";

export async function gatherContext(): Promise<ContextPayload> {
  const timeBucket = getTimeBucket();

  const [coords, locationType, upcomingEvent] = await Promise.all([
    getCurrentCoords(),
    classifyLocation(),
    getUpcomingEvents(),
  ]);

  let weatherTag: ContextPayload["weatherTag"] = "unknown";
  let weatherDescription = "";
  let temperature: number | null = null;

  if (coords) {
    const weather = await getWeather(coords.lat, coords.lon);
    weatherTag = weather.tag;
    weatherDescription = weather.description;
    temperature = weather.temperature;
  }

  return {
    locationType,
    weatherTag,
    weatherDescription,
    temperature,
    timeBucket,
    upcomingEvent,
    timestamp: Date.now(),
  };
}
