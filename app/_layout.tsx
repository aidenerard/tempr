import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { theme } from "@/constants/Colors";
import { getCalendarPermissionStatus } from "@/lib/calendar";
import { scanAndScheduleUpcomingEvents } from "@/lib/calendarNotifications";

export { ErrorBoundary } from "expo-router";

SplashScreen.preventAutoHideAsync();

const TemprDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: theme.primary,
    background: theme.bg,
    card: theme.bg,
    text: theme.text,
    border: theme.surfaceBorder,
    notification: theme.primary,
  },
};

function useCalendarAutoScan() {
  const { spotifyToken } = useAuth();
  const scanned = useRef(false);

  useEffect(() => {
    if (!spotifyToken || scanned.current) return;
    scanned.current = true;

    (async () => {
      const hasPermission = await getCalendarPermissionStatus();
      if (!hasPermission) return;
      try {
        await scanAndScheduleUpcomingEvents(spotifyToken);
      } catch (err) {
        console.log("[AutoScan] Calendar scan failed:", err);
      }
    })();
  }, [spotifyToken]);
}

function useNotificationNavigation() {
  const router = useRouter();

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === "calendar_recommendation") {
          router.push("/(tabs)/calendar");
        }
      },
    );
    return () => sub.remove();
  }, [router]);
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useCalendarAutoScan();
  useNotificationNavigation();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(tabs)";
    if (!session && inAuthGroup) {
      router.replace("/login");
    } else if (session && !inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments]);

  return <>{children}</>;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={TemprDark}>
      <StatusBar style="light" />
      <AuthGate>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </AuthGate>
    </ThemeProvider>
  );
}
