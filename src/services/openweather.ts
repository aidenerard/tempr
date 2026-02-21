/**
 * OpenWeather API service
 * Fetches weather data for contextual queue generation
 * Cache responses server-side via Supabase edge functions to avoid rate limits
 */

const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5";

export interface WeatherData {
  temp: number;
  feelsLike: number;
  description: string;
  main: string;
  icon: string;
  humidity: number;
  windSpeed: number;
}

/**
 * Get current weather by coordinates
 * Uses EXPO_PUBLIC_OPENWEATHER_API_KEY from env
 */
export async function getWeatherByCoords(
  lat: number,
  lon: number
): Promise<WeatherData> {
  const apiKey = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY ?? "";
  if (!apiKey) throw new Error("OpenWeather API key not configured");

  const res = await fetch(
    `${OPENWEATHER_BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`
  );
  if (!res.ok) throw new Error(`OpenWeather API error: ${res.status}`);
  const data = await res.json();

  return {
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    description: data.weather[0]?.description ?? "",
    main: data.weather[0]?.main ?? "",
    icon: data.weather[0]?.icon ?? "",
    humidity: data.main.humidity ?? 0,
    windSpeed: data.wind?.speed ?? 0,
  };
}

/**
 * Map weather conditions to mood/vibe for queue generation
 */
export function weatherToMood(weather: WeatherData): {
  valence: number;
  energy: number;
  description: string;
} {
  const main = weather.main.toLowerCase();
  const desc = weather.description.toLowerCase();

  if (main === "rain" || desc.includes("rain") || desc.includes("drizzle")) {
    return { valence: 0.4, energy: 0.3, description: "chill rainy day" };
  }
  if (main === "snow") {
    return { valence: 0.5, energy: 0.4, description: "cozy winter" };
  }
  if (main === "clear" && weather.temp > 25) {
    return { valence: 0.8, energy: 0.7, description: "sunny upbeat" };
  }
  if (main === "clouds" || desc.includes("cloud")) {
    return { valence: 0.5, energy: 0.5, description: "mellow overcast" };
  }
  if (main === "thunderstorm") {
    return { valence: 0.3, energy: 0.6, description: "intense storm" };
  }

  return { valence: 0.6, energy: 0.5, description: "neutral" };
}
