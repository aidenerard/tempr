import "react-native-gesture-handler";
import React, { useState, useEffect } from "react";
import { registerRootComponent } from "expo";
import { Text, View, ActivityIndicator } from "react-native";

function Root() {
  const [App, setApp] = useState<React.ComponentType | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;
    try {
      const LoadedApp = require("./App").default;
      if (mounted) setApp(() => LoadedApp);
    } catch (e) {
      if (mounted) setError(e as Error);
    }
    return () => { mounted = false; };
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
        <Text style={{ color: "red", fontSize: 14, textAlign: "center" }}>{error.message}</Text>
      </View>
    );
  }
  if (App) return <App />;
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" />
    </View>
  );
}

registerRootComponent(Root);
