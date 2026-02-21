import { eventToMood } from "../calendar";

describe("calendar", () => {
  describe("eventToMood", () => {
    it("maps date night to romantic", () => {
      const mood = eventToMood("Date night in 30 min");
      expect(mood).not.toBeNull();
      expect(mood!.description).toBe("romantic");
      expect(mood!.valence).toBe(0.8);
    });

    it("maps gym to workout upbeat", () => {
      const mood = eventToMood("Gym session");
      expect(mood).not.toBeNull();
      expect(mood!.description).toContain("workout");
      expect(mood!.energy).toBe(0.9);
    });

    it("maps flight to travel chill", () => {
      const mood = eventToMood("Flight to NYC");
      expect(mood).not.toBeNull();
      expect(mood!.description).toContain("travel");
    });

    it("returns null for generic event", () => {
      const mood = eventToMood("Meeting with team");
      expect(mood).toBeNull();
    });
  });
});
