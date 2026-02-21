import {
  getColors,
  setColorScheme,
  getCurrentScheme,
  colorSchemes,
  type ColorScheme,
} from "../colors";

describe("colors", () => {
  beforeEach(() => {
    setColorScheme("dark");
  });

  it("returns dark theme by default", () => {
    const colors = getColors();
    expect(colors.background).toBe("#121212");
    expect(colors.primary).toBe("#1DB954");
  });

  it("switches to light theme", () => {
    setColorScheme("light");
    const colors = getColors();
    expect(colors.background).toBe("#FFFFFF");
    expect(colors.text).toBe("#191414");
  });

  it("switches to midnight theme", () => {
    setColorScheme("midnight");
    const colors = getColors();
    expect(colors.primary).toBe("#8B5CF6");
    expect(colors.background).toBe("#0F0F23");
  });

  it("getCurrentScheme returns active scheme", () => {
    expect(getCurrentScheme()).toBe("dark");
    setColorScheme("light");
    expect(getCurrentScheme()).toBe("light");
  });

  it("all schemes have required keys", () => {
    const keys = [
      "primary",
      "secondary",
      "accent",
      "background",
      "surface",
      "text",
      "textMuted",
      "border",
      "success",
      "error",
      "warning",
    ];
    (Object.keys(colorSchemes) as ColorScheme[]).forEach((scheme) => {
      const colors = colorSchemes[scheme];
      keys.forEach((key) => {
        expect(colors).toHaveProperty(key);
        expect(typeof (colors as unknown as Record<string, unknown>)[key]).toBe("string");
      });
    });
  });
});
