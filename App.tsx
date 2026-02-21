import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";

export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tempr</Text>
      <Text style={styles.subtitle}>App is loading correctly</Text>
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#1DB954",
    fontSize: 32,
    fontWeight: "700",
  },
  subtitle: {
    color: "#B3B3B3",
    fontSize: 16,
    marginTop: 8,
  },
});
