import type { Config } from "jest";

const config: Config = {
  preset: "jest-expo/ios",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-reanimated|react-native-gesture-handler|react-native-worklets|@supabase/.*|@tanstack/.*|zustand|uuid)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@components/(.*)$": "<rootDir>/src/components/$1",
    "^@services/(.*)$": "<rootDir>/src/services/$1",
    "^@hooks/(.*)$": "<rootDir>/src/hooks/$1",
    "^@lib/(.*)$": "<rootDir>/src/lib/$1",
    "^@store/(.*)$": "<rootDir>/src/store/$1",
    "^@types/(.*)$": "<rootDir>/src/types/$1",
    "^@constants/(.*)$": "<rootDir>/src/constants/$1",
  },
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup.ts"],
  testMatch: ["**/__tests__/**/*.test.ts?(x)"],
  testPathIgnorePatterns: ["/node_modules/", "/android/", "/ios/"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/__tests__/**",
  ],
};

export default config;
