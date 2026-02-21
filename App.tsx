import "react-native-gesture-handler";
import "./global.css";

import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Text } from "react-native";

import { AuthProvider } from "./src/contexts/AuthContext";
import { QueueScreen } from "./src/screens/QueueScreen";
import { DiscoverScreen } from "./src/screens/DiscoverScreen";
import { getColors } from "./src/theme/colors";

const Tab = createBottomTabNavigator();

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const colors = getColors();
  return (
    <Text style={{ color: focused ? colors.primary : colors.textMuted, fontSize: 20 }}>
      {name === "Queue" ? "🎵" : "🔍"}
    </Text>
  );
}

export default function App() {
  const colors = getColors();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <NavigationContainer>
          <Tab.Navigator
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.text,
              tabBarStyle: { backgroundColor: colors.surface },
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.textMuted,
            }}
          >
            <Tab.Screen
              name="Queue"
              component={QueueScreen}
              options={{
                title: "Tempr",
                tabBarIcon: ({ focused }) => <TabIcon name="Queue" focused={focused} />,
              }}
            />
            <Tab.Screen
              name="Discover"
              component={DiscoverScreen}
              options={{
                tabBarIcon: ({ focused }) => <TabIcon name="Discover" focused={focused} />,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
