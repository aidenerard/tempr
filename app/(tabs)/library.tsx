import { StyleSheet, ScrollView } from "react-native";
import { Text, View } from "@/components/Themed";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/constants/Colors";

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + 16 }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.headerTitle}>Library</Text>

      <View style={styles.emptyState}>
        <View style={styles.emptyIconWrap}>
          <FontAwesome name="bookmark-o" size={36} color={theme.primary} />
        </View>
        <Text style={styles.emptyTitle}>No saved queues yet</Text>
        <Text style={styles.emptySubtitle}>
          Your generated queues will appear here. Head over to Generate and
          create your first one.
        </Text>
      </View>

      <View style={styles.featurePreview}>
        <Text style={styles.featureTitle}>Coming soon</Text>
        {[
          { icon: "save" as const, label: "Save queues to replay later" },
          { icon: "share" as const, label: "Share queues with friends" },
          { icon: "spotify" as const, label: "Export directly to Spotify" },
        ].map((item) => (
          <View style={styles.featureRow} key={item.label}>
            <View style={styles.featureIconWrap}>
              <FontAwesome name={item.icon} size={14} color={theme.primary} />
            </View>
            <Text style={styles.featureLabel}>{item.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    flexGrow: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
    marginBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    backgroundColor: "transparent",
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 24,
  },
  featurePreview: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    backgroundColor: "transparent",
  },
  featureIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.primaryMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  featureLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: "500",
  },
});
