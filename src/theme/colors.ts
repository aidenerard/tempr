/**
 * Tempr Color Scheme
 * Centralized color constants for dynamic theme switching.
 * Import these values throughout the app instead of hardcoding colors.
 */

export type ColorScheme = "light" | "dark" | "midnight";

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  border: string;
  success: string;
  error: string;
  warning: string;
}

export const colorSchemes: Record<ColorScheme, ThemeColors> = {
  light: {
    primary: "#1DB954", // Spotify green
    secondary: "#191414", // Spotify black
    accent: "#1ED760", // Spotify light green
    background: "#FFFFFF",
    surface: "#F5F5F5",
    text: "#191414",
    textMuted: "#6B7280",
    border: "#E5E7EB",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
  },
  dark: {
    primary: "#1DB954",
    secondary: "#121212",
    accent: "#1ED760",
    background: "#121212",
    surface: "#181818",
    text: "#FFFFFF",
    textMuted: "#B3B3B3",
    border: "#282828",
    success: "#22C55E",
    error: "#EF4444",
    warning: "#F59E0B",
  },
  midnight: {
    primary: "#8B5CF6", // Purple accent
    secondary: "#0F0F23",
    accent: "#A78BFA",
    background: "#0F0F23",
    surface: "#1A1A2E",
    text: "#E2E8F0",
    textMuted: "#94A3B8",
    border: "#2D2D44",
    success: "#34D399",
    error: "#F87171",
    warning: "#FBBF24",
  },
};

// Current active scheme - can be changed at runtime
let currentScheme: ColorScheme = "dark";

export const getColors = (): ThemeColors => colorSchemes[currentScheme];

export const setColorScheme = (scheme: ColorScheme): void => {
  currentScheme = scheme;
};

export const getCurrentScheme = (): ColorScheme => currentScheme;
