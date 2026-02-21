/**
 * Main queue screen - app-prompted and user-prompted generation
 */

import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { getColors } from "../theme/colors";
import { ScrollingPreviewCard } from "../components/ScrollingPreviewCard";
import { QueueMilestone } from "../components/QueueMilestone";
import type { PreviewTrack } from "../components/ScrollingPreviewCard";
import type { QueueTrack } from "../services/queueGenerator";
import {
  generateQueue,
  parseMoodFromPrompt,
  createPlaylistAndAddTracks,
  getCurrentUser,
} from "../services";
import { useAuth } from "../contexts/AuthContext";

type Mode = "idle" | "chat" | "preview" | "generating";

export function QueueScreen() {
  const colors = getColors();
  const { isAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>("idle");
  const [chatInput, setChatInput] = useState("");
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [previewQueue, setPreviewQueue] = useState<PreviewTrack[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  // TODO: Get from Supabase profile / Spotify OAuth - use env or auth context
  const spotifyToken = process.env.EXPO_PUBLIC_SPOTIFY_ACCESS_TOKEN ?? null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toPreviewTrack = (t: QueueTrack): PreviewTrack => ({
    id: t.id,
    name: t.name,
    artists: t.artists.map((a) => a.name).join(", "),
    albumArt: t.album?.images?.[0]?.url,
    previewUrl: t.preview_url,
  });

  const handleChatGenerate = async () => {
    if (!chatInput.trim() || !spotifyToken) return;
    setLoading(true);
    setError(null);
    try {
      const mood = await parseMoodFromPrompt(chatInput.trim());
      const tracks = await generateQueue(spotifyToken, {
        valence: mood.valence,
        energy: mood.energy,
        danceability: mood.danceability,
        tempo: mood.tempo,
      });
      setQueue(tracks);
      setPreviewQueue(tracks.map(toPreviewTrack));
      setMode("preview");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipeRight = (trackId: string) => {
    setPreviewQueue((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleSwipeLeft = (trackId: string) => {
    setRemovedIds((prev) => new Set(prev).add(trackId));
    setPreviewQueue((prev) => prev.filter((t) => t.id !== trackId));
  };

  const handleDoubleTap = async (trackId: string) => {
    if (!spotifyToken) return;
    try {
      await import("../services/spotify").then((m) =>
        m.addToLikedSongs(spotifyToken, [trackId])
      );
      Alert.alert("Added to Liked Songs", "Track added to your Spotify Liked Songs.");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    }
  };

  const savedQueue = queue.filter((t) => !removedIds.has(t.id));
  const totalDuration = savedQueue.reduce(
    (acc, t) => acc + t.duration_ms,
    0
  );

  const handleSaveToSpotify = async () => {
    if (!spotifyToken || savedQueue.length === 0) return;
    setLoading(true);
    try {
      const user = await getCurrentUser(spotifyToken);
      await createPlaylistAndAddTracks(
        spotifyToken,
        user.id,
        `Tempr Queue ${new Date().toLocaleDateString()}`,
        savedQueue.map((t) => `spotify:track:${t.id}`)
      );
      Alert.alert("Saved!", "Queue saved as Spotify playlist.");
    } catch (e) {
      Alert.alert("Error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: colors.text, fontSize: 18, textAlign: "center" }}>
          Sign in with Spotify to generate queues
        </Text>
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
          Queue
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 4 }}>
          Generate a queue from a mood prompt
        </Text>

        {mode === "idle" && (
          <View style={{ marginTop: 24 }}>
            <TextInput
              placeholder="e.g. late night chill vibes, quiet city"
              placeholderTextColor={colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
              style={{
                backgroundColor: colors.surface,
                borderRadius: 12,
                padding: 16,
                color: colors.text,
                fontSize: 16,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            />
            <TouchableOpacity
              onPress={handleChatGenerate}
              disabled={loading}
              style={{
                marginTop: 16,
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                  Generate Queue
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {error && (
          <View
            style={{
              marginTop: 16,
              padding: 12,
              backgroundColor: colors.error + "20",
              borderRadius: 8,
            }}
          >
            <Text style={{ color: colors.error }}>{error}</Text>
          </View>
        )}

        {mode === "preview" && previewQueue.length > 0 && (
          <View style={{ marginTop: 24 }}>
            <QueueMilestone totalDurationMs={totalDuration} />
            {previewQueue.map((track) => (
              <ScrollingPreviewCard
                key={track.id}
                track={track}
                onSwipeRight={() => handleSwipeRight(track.id)}
                onSwipeLeft={() => handleSwipeLeft(track.id)}
                onDoubleTap={() => handleDoubleTap(track.id)}
              />
            ))}
            <TouchableOpacity
              onPress={handleSaveToSpotify}
              disabled={loading}
              style={{
                marginTop: 24,
                backgroundColor: colors.primary,
                padding: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "600" }}>
                  Save to Spotify Playlist
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
