/**
 * Scrolling preview card for queue editing (Feature 4B)
 * Mock UI for music preview - swipe right (keep), left (remove), double tap (heart)
 * Uses react-native-gesture-handler + reanimated
 */

import React from "react";
import { View, Text, Image } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { getColors } from "../theme/colors";

export interface PreviewTrack {
  id: string;
  name: string;
  artists: string;
  albumArt?: string;
  previewUrl?: string | null;
}

interface ScrollingPreviewCardProps {
  track: PreviewTrack;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onDoubleTap: () => void;
}

const SWIPE_THRESHOLD = 80;

export function ScrollingPreviewCard({
  track,
  onSwipeRight,
  onSwipeLeft,
  onDoubleTap,
}: ScrollingPreviewCardProps) {
  const colors = getColors();
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (e.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(400, {}, () => {
          runOnJS(onSwipeRight)();
        });
      } else if (e.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(-400, {}, () => {
          runOnJS(onSwipeLeft)();
        });
      } else {
        translateX.value = withSpring(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      scale.value = withSpring(1.2, { damping: 10 }, () => {
        scale.value = withSpring(1);
        runOnJS(onDoubleTap)();
      });
    });

  const composed = Gesture.Simultaneous(panGesture, doubleTap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composed}>
        <Animated.View
          style={[
            animatedStyle,
            {
              backgroundColor: colors.surface,
              borderRadius: 16,
              padding: 20,
              marginHorizontal: 16,
              marginVertical: 8,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 4,
            },
          ]}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 8,
                backgroundColor: colors.border,
                overflow: "hidden",
              }}
            >
              {track.albumArt ? (
                <Image
                  source={{ uri: track.albumArt }}
                  style={{ width: 80, height: 80 }}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text style={{ color: colors.textMuted, fontSize: 24 }}>♪</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.text,
                  fontSize: 18,
                  fontWeight: "600",
                }}
                numberOfLines={1}
              >
                {track.name}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 14,
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {track.artists}
              </Text>
              <Text
                style={{
                  color: colors.textMuted,
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Tap to preview • Swipe right to keep • Left to remove • 2x tap to ♥
              </Text>
            </View>
          </View>
        </Animated.View>
      </GestureDetector>
  );
}
