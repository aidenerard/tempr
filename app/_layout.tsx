import FontAwesome from "@expo/vector-icons/FontAwesome";
import { ThemeProvider, DarkTheme } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import { useEffect, useRef } from "react";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/lib/AuthContext";
import { theme } from "@/constants/Colors";
import type { PromptedQueueNotificationData } from "@/lib/notifications";

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

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

function NotificationHandler() {
  const router = useRouter();
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content
          .data as PromptedQueueNotificationData | undefined;

        if (data?.type === "prompted_queue") {
          router.push("/prompted-queue");
        }
      });

    return () => {
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [router]);

  return null;
}

function RootLayoutNav() {
  return (
    <ThemeProvider value={TemprDark}>
      <StatusBar style="light" />
      <AuthGate>
        <NotificationHandler />
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="login" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="prompted-queue"
            options={{ animation: "slide_from_bottom", presentation: "modal" }}
          />
          <Stack.Screen
            name="settings"
            options={{ animation: "slide_from_right" }}
          />
        </Stack>
      </AuthGate>
    </ThemeProvider>
  );
}
