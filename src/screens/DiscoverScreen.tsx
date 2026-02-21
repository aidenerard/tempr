/**
 * Discover tab - scrolling mode for new music discovery (Feature 5)
 * Mock UI - no actual video/music integration per spec
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
} from "react-native";
import { getColors } from "../theme/colors";
import { ScrollingPreviewCard } from "../components/ScrollingPreviewCard";
import type { PreviewTrack } from "../components/ScrollingPreviewCard";

type DiscoverMode = "genre" | "history" | "random" | null;

const MOCK_TRACKS: PreviewTrack[] = [
  { id: "1", name: "New Discovery 1", artists: "Artist A", albumArt: undefined },
  { id: "2", name: "New Discovery 2", artists: "Artist B", albumArt: undefined },
  { id: "3", name: "New Discovery 3", artists: "Artist C", albumArt: undefined },
];

export function DiscoverScreen() {
  const colors = getColors();
  const [mode, setMode] = useState<DiscoverMode>(null);
  const [genreInput, setGenreInput] = useState("");
  const [tracks, setTracks] = useState<PreviewTrack[]>([]);
  const [showModePicker, setShowModePicker] = useState(true);

  const selectMode = (m: DiscoverMode) => {
    setMode(m);
    setShowModePicker(false);
    setTracks(MOCK_TRACKS);
  };

  const handleSwipeRight = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleSwipeLeft = (trackId: string) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleDoubleTap = (_trackId: string) => {
    // Add to Liked Songs - mock
  };

  if (showModePicker) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          Discover
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
          Choose how you want to discover new music
        </Text>

        <View style={{ marginTop: 32, gap: 16 }}>
          <TouchableOpacity
            onPress={() => selectMode("genre")}
            style={{
              backgroundColor: colors.surface,
              padding: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              Genre / Mood Input
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
              Type what you want to discover (e.g. "indie rock", "lo-fi beats")
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => selectMode("history")}
            style={{
              backgroundColor: colors.surface,
              padding: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              Listening History Based
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
              Suggestions based on your Spotify taste profile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => selectMode("random")}
            style={{
              backgroundColor: colors.surface,
              padding: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "600" }}>
              Fully Random
            </Text>
            <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
              Completely randomized new music discovery
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={{ padding: 20 }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "700" }}>
          Discover
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
          {mode === "genre" && "Genre/Mood mode"}
          {mode === "history" && "Based on your taste"}
          {mode === "random" && "Random discovery"}
        </Text>

        {mode === "genre" && (
          <TextInput
            placeholder="e.g. indie rock, lo-fi beats"
            placeholderTextColor={colors.textMuted}
            value={genreInput}
            onChangeText={setGenreInput}
            style={{
              marginTop: 16,
              backgroundColor: colors.surface,
              borderRadius: 12,
              padding: 16,
              color: colors.text,
              fontSize: 16,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          />
        )}

        <Text
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginTop: 16,
            fontStyle: "italic",
          }}
        >
          Mock UI - YouTube/Spotify API integration to be added
        </Text>

        {tracks.map((track) => (
          <ScrollingPreviewCard
            key={track.id}
            track={track}
            onSwipeRight={() => handleSwipeRight(track.id)}
            onSwipeLeft={() => handleSwipeLeft(track.id)}
            onDoubleTap={() => handleDoubleTap(track.id)}
          />
        ))}
      </View>
    </ScrollView>
  );
}
