import * as Location from "expo-location";
import type { LocationType } from "./types";

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

export async function getCurrentCoords(): Promise<{
  lat: number;
  lon: number;
} | null> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return { lat: loc.coords.latitude, lon: loc.coords.longitude };
  } catch (err) {
    console.warn("[Location] failed:", err);
    return null;
  }
}

export async function classifyLocation(): Promise<LocationType> {
  try {
    const coords = await getCurrentCoords();
    if (!coords) return "unknown";

    const [place] = await Location.reverseGeocodeAsync({
      latitude: coords.lat,
      longitude: coords.lon,
    });
    if (!place) return "unknown";

    const name = [place.name, place.street, place.subregion, place.region]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (/gym|fitness|crossfit|sport/i.test(name)) return "gym";
    if (/library|biblioth/i.test(name)) return "library";
    if (/airport|terminal|aviation/i.test(name)) return "airport";
    if (/cafe|coffee|starbucks/i.test(name)) return "cafe";
    if (/restaurant|diner|bistro/i.test(name)) return "restaurant";
    if (/bar|pub|lounge|club/i.test(name)) return "bar";
    if (/park|garden|trail/i.test(name)) return "park";
    if (/station|metro|subway|bus/i.test(name)) return "transit";

    return "unknown";
  } catch (err) {
    console.warn("[Location] classify failed:", err);
    return "unknown";
  }
}
