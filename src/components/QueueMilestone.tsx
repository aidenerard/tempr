/**
 * Queue length milestone display (e.g. "You've built a 30-min queue!")
 */

import React from "react";
import { View, Text } from "react-native";
import { getColors } from "../theme/colors";

const MILESTONES = [
  { minutes: 15, message: "15 min of vibes!" },
  { minutes: 30, message: "You've built a 30-min queue!" },
  { minutes: 45, message: "45 min queue!" },
  { minutes: 60, message: "60 min queue!" },
  { minutes: 90, message: "90 min of music!" },
];

interface QueueMilestoneProps {
  totalDurationMs: number;
}

export function QueueMilestone({ totalDurationMs }: QueueMilestoneProps) {
  const colors = getColors();
  const totalMinutes = Math.floor(totalDurationMs / 60000);
  const reached = MILESTONES.filter((m) => totalMinutes >= m.minutes);
  const current = reached[reached.length - 1];

  if (!current) return null;

  return (
    <View
      style={{
        padding: 12,
        backgroundColor: colors.primary + "20",
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: colors.primary,
          fontSize: 16,
          fontWeight: "600",
        }}
      >
        🎵 {current.message}
      </Text>
      <Text
        style={{
          color: colors.textMuted,
          fontSize: 12,
          marginTop: 4,
        }}
      >
        ~{totalMinutes} min total
      </Text>
    </View>
  );
}
