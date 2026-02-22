import {
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  Animated as RNAnimated,
  Dimensions,
  PanResponder,
  ScrollView,
} from "react-native";
import { Text, View } from "@/components/Themed";
import { useState, useRef, useCallback, useMemo } from "react";
import { FontAwesome } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/lib/AuthContext";
import { theme } from "@/constants/Colors";
import { getTopTracks, getTopArtists, searchTracks } from "@/lib/spotify";
import { generateBlendQueue, type MoodCoordinate } from "@/lib/gemini";
import { saveQueue } from "@/lib/queueStorage";
import * as Haptics from "expo-haptics";

const { width: SCREEN_W } = Dimensions.get("window");
const PAD_SIZE = Math.min(SCREEN_W - 48, 340);
const PIN_SIZE = 28;

type Zone = {
  name: string;
  emoji: string;
  color: string;
  x: [number, number];
  y: [number, number];
};

const ZONES: Zone[] = [
  { name: "Melancholic", emoji: "🌧", color: "#6366F1", x: [0, 0.5], y: [0, 0.5] },
  { name: "Peaceful",    emoji: "🌿", color: "#10B981", x: [0.5, 1], y: [0, 0.5] },
  { name: "Angry",       emoji: "🔥", color: "#EF4444", x: [0, 0.5], y: [0.5, 1] },
  { name: "Euphoric",    emoji: "✨", color: "#F59E0B", x: [0.5, 1], y: [0.5, 1] },
];

function getZone(energy: number, valence: number): Zone {
  return (
    ZONES.find(
      (z) =>
        valence >= z.x[0] &&
        valence < z.x[1] &&
        energy >= z.y[0] &&
        energy < z.y[1],
    ) ?? ZONES[3]
  );
}

function blendColors(energy: number, valence: number): string[] {
  const r = Math.round(80 + energy * 120 + (1 - valence) * 50);
  const g = Math.round(20 + valence * 100 - energy * 40);
  const b = Math.round(100 + (1 - energy) * 100 + (1 - valence) * 50);
  const r2 = Math.round(r * 0.4);
  const g2 = Math.round(g * 0.4);
  const b2 = Math.round(b * 0.4);
  return [
    `rgb(${Math.min(r, 255)}, ${Math.max(g, 0)}, ${Math.min(b, 255)})`,
    `rgb(${r2}, ${Math.max(g2, 0)}, ${b2})`,
  ];
}

type SongEntry = { name: string; albumArt?: string };

type BlendResult = {
  songs: SongEntry[];
  reasoning: string;
  moodLine: string;
  coord: MoodCoordinate;
  zone: string;
  saved: boolean;
};

export default function BlendScreen() {
  const { spotifyToken } = useAuth();
  const insets = useSafeAreaInsets();

  const [coord, setCoord] = useState<MoodCoordinate>({ energy: 0.5, valence: 0.5 });
  const [dragging, setDragging] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<BlendResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentZoneRef = useRef<string>("Euphoric");
  const padScaleAnim = useRef(new RNAnimated.Value(1)).current;
  const pinScaleAnim = useRef(new RNAnimated.Value(1)).current;
  const resultAnim = useRef(new RNAnimated.Value(0)).current;

  const zone = getZone(coord.energy, coord.valence);
  const [gradTop, gradBot] = blendColors(coord.energy, coord.valence);

  const padLayoutRef = useRef({ x: 0, y: 0, w: PAD_SIZE, h: PAD_SIZE });
  const padViewRef = useRef<any>(null);

  const measurePad = useCallback(() => {
    const node = padViewRef.current;
    if (node?.measureInWindow) {
      node.measureInWindow(
        (x: number, y: number, w: number, h: number) => {
          if (w > 0 && h > 0) {
            padLayoutRef.current = { x, y, w, h };
          }
        },
      );
    }
  }, []);

  const updateCoord = useCallback(
    (pageX: number, pageY: number) => {
      const { x, y, w, h } = padLayoutRef.current;
      const relX = Math.max(0, Math.min(1, (pageX - x) / w));
      const relY = Math.max(0, Math.min(1, 1 - (pageY - y) / h));

      setCoord({ energy: relY, valence: relX });

      const newZone = getZone(relY, relX);
      if (newZone.name !== currentZoneRef.current) {
        currentZoneRef.current = newZone.name;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
    },
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !generating,
        onMoveShouldSetPanResponder: () => !generating,
        onPanResponderGrant: (_, gesture) => {
          setDragging(true);
          setResult(null);
          setError(null);
          measurePad();
          RNAnimated.spring(padScaleAnim, {
            toValue: 1.02,
            tension: 300,
            friction: 15,
            useNativeDriver: true,
          }).start();
          RNAnimated.spring(pinScaleAnim, {
            toValue: 1.4,
            tension: 200,
            friction: 10,
            useNativeDriver: true,
          }).start();
          updateCoord(gesture.x0, gesture.y0);
        },
        onPanResponderMove: (_, gesture) => {
          updateCoord(gesture.moveX, gesture.moveY);
        },
        onPanResponderRelease: () => {
          setDragging(false);
          RNAnimated.spring(padScaleAnim, {
            toValue: 1,
            tension: 200,
            friction: 12,
            useNativeDriver: true,
          }).start();
          RNAnimated.spring(pinScaleAnim, {
            toValue: 1,
            tension: 200,
            friction: 12,
            useNativeDriver: true,
          }).start();
        },
      }),
    [generating],
  );

  const handleGenerate = async () => {
    if (!spotifyToken || generating) return;
    setGenerating(true);
    setError(null);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    try {
      const [topTracks, topArtists] = await Promise.all([
        getTopTracks(spotifyToken, 20),
        getTopArtists(spotifyToken, 15),
      ]);

      const suggestions = await generateBlendQueue(
        coord,
        zone.name,
        topTracks,
        topArtists,
      );

      const artLookup = new Map<string, string>();
      for (const t of topTracks) {
        const art = t.album.images[t.album.images.length - 1]?.url;
        if (!art) continue;
        artLookup.set(
          `${t.name} - ${t.artists[0]?.name}`.toLowerCase(),
          art,
        );
        artLookup.set(t.name.toLowerCase(), art);
      }

      const allSongs = [
        ...(suggestions.familiar ?? []),
        ...(suggestions.discoveries ?? []),
      ];
      const songs: SongEntry[] = allSongs.map((n) => {
        const lower = n.toLowerCase();
        const art =
          artLookup.get(lower) ??
          Array.from(artLookup.entries()).find(
            ([k]) => lower.includes(k) || k.includes(lower),
          )?.[1];
        return { name: n, albumArt: art };
      });

      const af = suggestions.audioFeatures;
      const energyLabel =
        af.energy < 0.3 ? "low energy" : af.energy < 0.7 ? "moderate energy" : "high energy";
      const moodLabel =
        af.valence < 0.3 ? "melancholic" : af.valence < 0.7 ? "balanced" : "uplifting";
      const moodLine = `${moodLabel} · ${energyLabel} · ~${Math.round(af.tempo)} BPM`;

      const blendResult: BlendResult = {
        songs,
        reasoning: suggestions.reasoning,
        moodLine,
        coord: { ...coord },
        zone: zone.name,
        saved: false,
      };
      setResult(blendResult);

      resultAnim.setValue(0);
      RNAnimated.spring(resultAnim, {
        toValue: 1,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }).start();

      fetchMissingArt(songs, spotifyToken);
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
    } finally {
      setGenerating(false);
    }
  };

  const fetchMissingArt = async (songs: SongEntry[], token: string) => {
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await wait(8000);

    for (let i = 0; i < songs.length; i++) {
      if (songs[i].albumArt) continue;
      try {
        const results = await searchTracks(token, songs[i].name, 1);
        const art =
          results[0]?.album.images[results[0].album.images.length - 1]?.url;
        if (art) {
          setResult((prev) => {
            if (!prev) return prev;
            const updated = [...prev.songs];
            updated[i] = { ...updated[i], albumArt: art };
            return { ...prev, songs: updated };
          });
        }
      } catch {
        await wait(8000);
        i--;
        continue;
      }
      await wait(2500);
    }
  };

  const handleSave = async () => {
    if (!result || result.saved) return;
    await saveQueue({
      id: Date.now().toString(),
      prompt: `Mood Blend: ${result.zone} (E:${result.coord.energy.toFixed(2)} V:${result.coord.valence.toFixed(2)})`,
      moodLine: result.moodLine,
      songs: result.songs.map((s) => ({ name: s.name, albumArt: s.albumArt })),
      savedAt: Date.now(),
    });
    setResult((prev) => (prev ? { ...prev, saved: true } : prev));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const pinLeft = coord.valence * PAD_SIZE - PIN_SIZE / 2;
  const pinTop = (1 - coord.energy) * PAD_SIZE - PIN_SIZE / 2;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEnabled={!dragging}
    >
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Mood Blend</Text>
      </View>

      <Text style={styles.subtitle}>
        Drag to find your mood. Tap Generate to create a queue.
      </Text>

      <View style={styles.padWrapper}>
        <View style={styles.axisLabelTop}>
          <FontAwesome name="bolt" size={11} color={theme.textMuted} />
          <Text style={styles.axisText}>High Energy</Text>
        </View>

        <View style={styles.padRow}>
          <View style={styles.axisLabelLeft}>
            <Text style={[styles.axisText, styles.axisVertical]}>Sad</Text>
          </View>

          <RNAnimated.View
            ref={padViewRef as any}
            style={[
              styles.pad,
              { width: PAD_SIZE, height: PAD_SIZE, transform: [{ scale: padScaleAnim }] },
            ]}
            onLayout={() => {
              setTimeout(measurePad, 100);
            }}
            {...panResponder.panHandlers}
          >
            <View style={[styles.padGradient, { backgroundColor: gradBot }]}>
              <View
                style={[
                  styles.padGradientOverlay,
                  { backgroundColor: gradTop, opacity: 0.6 },
                ]}
              />
            </View>

            {ZONES.map((z) => (
              <View
                key={z.name}
                style={[
                  styles.zoneLabel,
                  {
                    left: z.x[0] === 0 ? "8%" : "58%",
                    top: z.y[1] <= 0.5 ? "58%" : "12%",
                  },
                ]}
              >
                <Text style={styles.zoneEmoji}>{z.emoji}</Text>
                <Text
                  style={[
                    styles.zoneName,
                    zone.name === z.name && styles.zoneNameActive,
                  ]}
                >
                  {z.name}
                </Text>
              </View>
            ))}

            <View style={styles.crosshairH} />
            <View style={styles.crosshairV} />

            <RNAnimated.View
              style={[
                styles.pin,
                {
                  left: pinLeft,
                  top: pinTop,
                  backgroundColor: zone.color,
                  transform: [{ scale: pinScaleAnim }],
                },
              ]}
            >
              <View style={styles.pinInner} />
            </RNAnimated.View>

            {dragging && (
              <View
                style={[
                  styles.coordBadge,
                  {
                    left: Math.max(
                      4,
                      Math.min(pinLeft - 30, PAD_SIZE - 84),
                    ),
                    top: Math.max(4, pinTop - 32),
                  },
                ]}
              >
                <Text style={styles.coordText}>
                  E:{coord.energy.toFixed(2)} V:{coord.valence.toFixed(2)}
                </Text>
              </View>
            )}
          </RNAnimated.View>

          <View style={styles.axisLabelRight}>
            <Text style={[styles.axisText, styles.axisVertical]}>Happy</Text>
          </View>
        </View>

        <View style={styles.axisLabelBottom}>
          <Text style={styles.axisText}>Low Energy</Text>
          <FontAwesome name="leaf" size={11} color={theme.textMuted} />
        </View>
      </View>

      <View
        style={[
          styles.zoneIndicator,
          { borderColor: zone.color + "40", backgroundColor: zone.color + "12" },
        ]}
      >
        <Text style={styles.zoneIndicatorEmoji}>{zone.emoji}</Text>
        <View style={styles.zoneIndicatorInfo}>
          <Text style={[styles.zoneIndicatorName, { color: zone.color }]}>
            {zone.name}
          </Text>
          <Text style={styles.zoneIndicatorCoords}>
            Energy {Math.round(coord.energy * 100)}% · Valence{" "}
            {Math.round(coord.valence * 100)}%
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.generateBtn,
          generating && styles.generateBtnDisabled,
          pressed && !generating && styles.generateBtnPressed,
        ]}
        onPress={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.generateBtnText}>Blending...</Text>
          </>
        ) : (
          <>
            <FontAwesome name="magic" size={16} color="#fff" />
            <Text style={styles.generateBtnText}>Generate from this Mood</Text>
          </>
        )}
      </Pressable>

      {error && (
        <View style={styles.errorCard}>
          <FontAwesome name="exclamation-circle" size={14} color={theme.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <RNAnimated.View
          style={[
            styles.resultSection,
            {
              opacity: resultAnim,
              transform: [
                {
                  translateY: resultAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.resultHeader,
              { borderLeftColor: getZone(result.coord.energy, result.coord.valence).color },
            ]}
          >
            <Text style={styles.resultZone}>
              {getZone(result.coord.energy, result.coord.valence).emoji}{" "}
              {result.zone} Blend
            </Text>
            <Text style={styles.resultMoodLine}>{result.moodLine}</Text>
            <Text style={styles.resultReasoning}>{result.reasoning}</Text>
          </View>

          <View style={styles.trackList}>
            {result.songs.map((song, i) => {
              const parts = song.name.split(" - ");
              const title = parts[0]?.trim() ?? song.name;
              const artist = parts[1]?.trim();
              return (
                <View style={styles.trackRow} key={`${song.name}-${i}`}>
                  <Text style={styles.trackIndex}>{i + 1}</Text>
                  {song.albumArt ? (
                    <Image
                      source={{ uri: song.albumArt }}
                      style={styles.albumArt}
                    />
                  ) : (
                    <View style={styles.albumPlaceholder}>
                      <FontAwesome name="music" size={12} color={theme.textMuted} />
                    </View>
                  )}
                  <View style={styles.trackInfo}>
                    <Text style={styles.trackName} numberOfLines={1}>
                      {title}
                    </Text>
                    {artist && (
                      <Text style={styles.trackArtist} numberOfLines={1}>
                        {artist}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
            <View style={styles.trackFooter}>
              <FontAwesome name="music" size={11} color={theme.primary} />
              <Text style={styles.trackFooterText}>
                {result.songs.length} tracks
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              result.saved && styles.saveBtnSaved,
              pressed && !result.saved && styles.saveBtnPressed,
            ]}
            onPress={handleSave}
            disabled={result.saved}
          >
            <FontAwesome
              name={result.saved ? "check" : "bookmark-o"}
              size={14}
              color={result.saved ? theme.success : theme.primary}
            />
            <Text
              style={[
                styles.saveBtnText,
                result.saved && styles.saveBtnTextSaved,
              ]}
            >
              {result.saved ? "Saved to Library" : "Save to Library"}
            </Text>
          </Pressable>
        </RNAnimated.View>
      )}

      <View style={styles.bottomPad} />
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
    paddingBottom: 60,
  },
  headerBar: {
    paddingHorizontal: 4,
    paddingVertical: 14,
    backgroundColor: "transparent",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 20,
    paddingHorizontal: 4,
  },

  padWrapper: {
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: "transparent",
  },
  axisLabelTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
    backgroundColor: "transparent",
  },
  axisLabelBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    backgroundColor: "transparent",
  },
  axisText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  axisVertical: {
    writingDirection: "ltr",
  },
  padRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "transparent",
  },
  axisLabelLeft: {
    width: 16,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  axisLabelRight: {
    width: 16,
    alignItems: "center",
    backgroundColor: "transparent",
  },

  pad: {
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    position: "relative",
  },
  padGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  padGradientOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
  },

  zoneLabel: {
    position: "absolute",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  zoneEmoji: {
    fontSize: 20,
  },
  zoneName: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 2,
  },
  zoneNameActive: {
    color: "rgba(255,255,255,0.7)",
  },

  crosshairH: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  crosshairV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    width: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.12)",
  },

  pin: {
    position: "absolute",
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  pinInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },

  coordBadge: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.75)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  coordText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  zoneIndicator: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 16,
  },
  zoneIndicatorEmoji: {
    fontSize: 28,
  },
  zoneIndicatorInfo: {
    flex: 1,
    backgroundColor: "transparent",
  },
  zoneIndicatorName: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  zoneIndicatorCoords: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },

  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginBottom: 16,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  generateBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.dangerMuted,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.dangerBorder,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: theme.danger,
    fontWeight: "500",
  },

  resultSection: {
    marginTop: 4,
    backgroundColor: "transparent",
  },
  resultHeader: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
    borderLeftWidth: 3,
  },
  resultZone: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.text,
    letterSpacing: -0.3,
  },
  resultMoodLine: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 6,
  },
  resultReasoning: {
    fontSize: 13,
    color: theme.textSecondary,
    marginTop: 8,
    lineHeight: 19,
  },

  trackList: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.surfaceBorder,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.surfaceBorder,
    backgroundColor: "transparent",
  },
  trackIndex: {
    width: 24,
    fontSize: 12,
    color: theme.textMuted,
    textAlign: "center",
    fontWeight: "500",
  },
  albumArt: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  albumPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 6,
    backgroundColor: theme.surfaceLight,
    alignItems: "center",
    justifyContent: "center",
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: "transparent",
  },
  trackName: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
  },
  trackArtist: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  trackFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    backgroundColor: "transparent",
  },
  trackFooterText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: "500",
  },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: theme.primaryMuted,
    borderWidth: 1,
    borderColor: theme.primaryBorder,
  },
  saveBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  saveBtnSaved: {
    backgroundColor: theme.successMuted,
    borderColor: "rgba(52, 199, 89, 0.25)",
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.primary,
  },
  saveBtnTextSaved: {
    color: theme.success,
  },

  bottomPad: {
    height: 20,
    backgroundColor: "transparent",
  },
});
