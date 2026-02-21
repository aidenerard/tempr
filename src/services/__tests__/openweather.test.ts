import { weatherToMood, type WeatherData } from "../openweather";

describe("openweather", () => {
  describe("weatherToMood", () => {
    it("maps rain to chill mood", () => {
      const weather: WeatherData = {
        temp: 15,
        feelsLike: 14,
        description: "light rain",
        main: "Rain",
        icon: "10d",
        humidity: 80,
        windSpeed: 5,
      };
      const mood = weatherToMood(weather);
      expect(mood.valence).toBe(0.4);
      expect(mood.energy).toBe(0.3);
      expect(mood.description).toContain("rain");
    });

    it("maps clear hot weather to upbeat", () => {
      const weather: WeatherData = {
        temp: 28,
        feelsLike: 30,
        description: "clear sky",
        main: "Clear",
        icon: "01d",
        humidity: 40,
        windSpeed: 2,
      };
      const mood = weatherToMood(weather);
      expect(mood.valence).toBe(0.8);
      expect(mood.energy).toBe(0.7);
    });

    it("maps gym/workout event", () => {
      const weather: WeatherData = {
        temp: 20,
        feelsLike: 19,
        description: "clouds",
        main: "Clouds",
        icon: "04d",
        humidity: 60,
        windSpeed: 3,
      };
      const mood = weatherToMood(weather);
      expect(mood.description).toContain("overcast");
    });
  });
});
