import type { WeatherTag } from "./types";

const OPENWEATHER_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5/weather";

type WeatherResponse = {
  weather: { id: number; main: string; description: string }[];
  main: { temp: number; feels_like: number };
  wind: { speed: number };
};

export type WeatherResult = {
  tag: WeatherTag;
  description: string;
  temperature: number;
};

// https://openweathermap.org/weather-conditions
function weatherIdToTag(id: number, temp: number): WeatherTag {
  if (id >= 200 && id < 300) return "storm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) {
    if (id === 781) return "storm";
    if (id === 771) return "windy";
    return "foggy";
  }
  if (id === 800) {
    if (temp > 32) return "hot";
    if (temp < 5) return "cold";
    return "clear";
  }
  if (id > 800) return "cloudy";
  return "unknown";
}

export async function getWeather(
  lat: number,
  lon: number
): Promise<WeatherResult> {
  if (!OPENWEATHER_KEY) {
    return { tag: "unknown", description: "API key not set", temperature: 0 };
  }

  const url = `${BASE_URL}?lat=${lat}&lon=${lon}&units=metric&appid=${OPENWEATHER_KEY}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[Weather] API error:", res.status);
      return { tag: "unknown", description: "API error", temperature: 0 };
    }

    const data: WeatherResponse = await res.json();
    const temp = Math.round(data.main.temp);
    const condition = data.weather[0];
    const tag = weatherIdToTag(condition.id, temp);

    return {
      tag,
      description: condition.description,
      temperature: temp,
    };
  } catch (err) {
    console.warn("[Weather] fetch failed:", err);
    return { tag: "unknown", description: "fetch failed", temperature: 0 };
  }
}
