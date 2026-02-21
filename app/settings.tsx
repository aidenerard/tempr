import { StyleSheet, ScrollView, Pressable, Switch, Alert } from "react-native";
import { Text, View } from "@/components/Themed";
import { useEffect, useState, useCallback } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { theme } from "@/constants/Colors";
import { getPromptSettings, savePromptSettings } from "@/lib/settings";
import { requestNotificationPermission } from "@/lib/notifications";
import { requestLocationPermission, requestCalendarPermission } from "@/lib/context";
import type { PromptSettings } from "@/lib/context/types";
import { trackEvent } from "@/lib/analytics";

type PermissionStatus = {
  notifications: boolean;
  location: boolean;
  calendar: boolean;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [settings, setSettings] = useState<PromptSettings | null>(null);
  const [permissions, setPermissions] = useState<PermissionStatus>({
    notifications: false,
    location: false,
    calendar: false,
  });

  useEffect(() => {
    getPromptSettings().then(setSettings);
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    const { default: Location } = await import("expo-location");
    const { default: Calendar } = await import("expo-calendar");
    const Notifications = await import("expo-notifications");

    const [locPerm, calPerm, notifPerm] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Calendar.getCalendarPermissionsAsync(),
      Notifications.getPermissionsAsync(),
    ]);

    setPermissions({
      location: locPerm.status === "granted",
      calendar: calPerm.status === "granted",
      notifications: notifPerm.status === "granted",
    });
  };

  const updateSetting = useCallback(
    async (key: keyof PromptSettings, value: boolean | number) => {
      if (!settings) return;
      const updated = { ...settings, [key]: value };
      setSettings(updated);
      await savePromptSettings({ [key]: value });
      trackEvent({
        name: "settings_changed",
        properties: { setting: key, value },
      });
    },
    [settings]
  );

  const requestPermission = useCallback(
    async (type: "notifications" | "location" | "calendar") => {
      let granted = false;
      switch (type) {
        case "notifications":
          granted = await requestNotificationPermission();
          break;
        case "location":
          granted = await requestLocationPermission();
          break;
        case "calendar":
          granted = await requestCalendarPermission();
          break;
      }

      trackEvent({
        name: granted ? "permission_granted" : "permission_denied",
        properties: { permission: type },
      });

      await checkPermissions();
    },
    []
  );

  if (!settings) return null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <FontAwesome name="chevron-left" size={18} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Smart Prompts</Text>
        <View style={{ width: 18, backgroundColor: "transparent" }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.description}>
          Tempr can detect your context — weather, calendar events, location, and
          time of day — to proactively build queues that match your moment.
        </Text>

        <Text style={styles.sectionTitle}>Permissions</Text>
        <View style={styles.card}>
          <PermissionRow
            icon="bell"
            label="Notifications"
            description="Receive prompt notifications when a queue is ready"
            granted={permissions.notifications}
            onRequest={() => requestPermission("notifications")}
          />
          <View style={styles.divider} />
          <PermissionRow
            icon="map-marker"
            label="Location"
            description="Detect places like gym, airport, or cafe for relevant queues"
            granted={permissions.location}
            onRequest={() => requestPermission("location")}
          />
          <View style={styles.divider} />
          <PermissionRow
            icon="calendar"
            label="Calendar"
            description="Read upcoming events to suggest pre-event queues"
            granted={permissions.calendar}
            onRequest={() => requestPermission("calendar")}
          />
        </View>

        <Text style={styles.sectionTitle}>Prompt Sources</Text>
        <View style={styles.card}>
          <ToggleRow
            icon="cloud"
            label="Weather-based prompts"
            description="Get queues based on rain, snow, or sunny weather"
            value={settings.weatherPrompts}
            onToggle={(v) => updateSetting("weatherPrompts", v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="calendar-check-o"
            label="Calendar-based prompts"
            description="Pre-event queues for workouts, dates, study, etc."
            value={settings.calendarPrompts}
            onToggle={(v) => updateSetting("calendarPrompts", v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="location-arrow"
            label="Location-based prompts"
            description="Queue suggestions based on where you are"
            value={settings.locationPrompts}
            onToggle={(v) => updateSetting("locationPrompts", v)}
          />
          <View style={styles.divider} />
          <ToggleRow
            icon="clock-o"
            label="Time-of-day prompts"
            description="Morning wake-up, evening wind-down queues"
            value={settings.timeOfDayPrompts}
            onToggle={(v) => updateSetting("timeOfDayPrompts", v)}
          />
        </View>

        <Text style={styles.sectionTitle}>Frequency Controls</Text>
        <View style={styles.card}>
          <View style={styles.controlRow}>
            <View style={styles.controlInfo}>
              <Text style={styles.controlLabel}>Max prompts per day</Text>
              <Text style={styles.controlDescription}>
                Limit how many prompted queues you receive daily
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                style={styles.stepperBtn}
                onPress={() =>
                  updateSetting(
                    "maxPromptsPerDay",
                    Math.max(1, settings.maxPromptsPerDay - 1)
                  )
                }
              >
                <FontAwesome name="minus" size={12} color={theme.text} />
              </Pressable>
              <Text style={styles.stepperValue}>
                {settings.maxPromptsPerDay}
              </Text>
              <Pressable
                style={styles.stepperBtn}
                onPress={() =>
                  updateSetting(
                    "maxPromptsPerDay",
                    Math.min(10, settings.maxPromptsPerDay + 1)
                  )
                }
              >
                <FontAwesome name="plus" size={12} color={theme.text} />
              </Pressable>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.controlRow}>
            <View style={styles.controlInfo}>
              <Text style={styles.controlLabel}>Quiet hours</Text>
              <Text style={styles.controlDescription}>
                No prompts between {formatHour(settings.quietHoursStart)} and{" "}
                {formatHour(settings.quietHoursEnd)}
              </Text>
            </View>
            <View style={styles.quietHoursControl}>
              <Pressable
                style={styles.hourBtn}
                onPress={() =>
                  updateSetting(
                    "quietHoursStart",
                    (settings.quietHoursStart - 1 + 24) % 24
                  )
                }
              >
                <FontAwesome name="chevron-down" size={10} color={theme.textMuted} />
              </Pressable>
              <Text style={styles.hourText}>
                {formatHour(settings.quietHoursStart)} –{" "}
                {formatHour(settings.quietHoursEnd)}
              </Text>
              <Pressable
                style={styles.hourBtn}
                onPress={() =>
                  updateSetting(
                    "quietHoursEnd",
                    (settings.quietHoursEnd + 1) % 24
                  )
                }
              >
                <FontAwesome name="chevron-up" size={10} color={theme.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.privacyCard}>
          <FontAwesome name="shield" size={16} color={theme.primaryLight} />
          <View style={styles.privacyContent}>
            <Text style={styles.privacyTitle}>Your privacy</Text>
            <Text style={styles.privacyText}>
              Context data (weather, calendar type, location category) is
              processed on-device and never stored on our servers. Calendar event
              titles are only used to infer event type — full text is never
              transmitted.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function PermissionRow({
  icon,
  label,
  description,
  granted,
  onRequest,
}: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  label: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
}) {
  return (
    <View style={styles.permRow}>
      <View style={styles.permIconWrap}>
        <FontAwesome
          name={icon}
          size={16}
          color={granted ? theme.success : theme.textMuted}
        />
      </View>
      <View style={styles.permInfo}>
        <Text style={styles.permLabel}>{label}</Text>
        <Text style={styles.permDescription}>{description}</Text>
      </View>
      {granted ? (
        <View style={styles.permGranted}>
          <FontAwesome name="check" size={12} color={theme.success} />
        </View>
      ) : (
        <Pressable style={styles.permButton} onPress={onRequest}>
          <Text style={styles.permButtonText}>Enable</Text>
        </Pressable>
      )}
    </View>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onToggle,
}: {
  icon: React.ComponentProps<typeof FontAwesome>["name"];
  label: string;
  description: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.permIconWrap}>
        <FontAwesome name={icon} size={16} color={theme.primary} />
      </View>
      <View style={styles.permInfo}>
        <Text style={styles.permLabel}>{label}</Text>
        <Text style={styles.permDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.surfaceLight, true: theme.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: theme.text,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  description: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    marginBottom: 24,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.surfaceBorder,
    marginVertical: 14,
  },
  permRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  permIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  permInfo: {
    flex: 1,
    backgroundColor: "transparent",
  },
  permLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  permDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
    lineHeight: 17,
  },
  permGranted: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.successMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  permButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  permButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.primary,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  controlInfo: {
    flex: 1,
    backgroundColor: "transparent",
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  controlDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "transparent",
  },
  stepperBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "700",
    color: theme.text,
    minWidth: 20,
    textAlign: "center",
  },
  quietHoursControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
  },
  hourBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  hourText: {
    fontSize: 13,
    fontWeight: "600",
    color: theme.text,
  },
  privacyCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    alignItems: "flex-start",
  },
  privacyContent: {
    flex: 1,
    backgroundColor: "transparent",
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.primaryLight,
    marginBottom: 4,
  },
  privacyText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  },
});
