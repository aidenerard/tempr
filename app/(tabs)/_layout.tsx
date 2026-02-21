import { Tabs } from "expo-router";
import { Text } from "react-native";
import { getColors } from "../../src/theme/colors";

export default function TabLayout() {
  const colors = getColors();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Queue",
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? colors.primary : colors.textMuted, fontSize: 20 }}>
              ♪
            </Text>
          ),
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: "Discover",
          tabBarIcon: ({ focused }) => (
            <Text style={{ color: focused ? colors.primary : colors.textMuted, fontSize: 20 }}>
              🔍
            </Text>
          ),
        }}
      />
    </Tabs>
  );
}
