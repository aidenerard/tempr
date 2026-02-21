import React from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { SpotifyTrack } from '../../types';

type DiscoverMode = 'genre' | 'history' | 'random';

// ── DiscoverModeSelector ──────────────────────────────────────────────────────

interface DiscoverModeSelectorProps {
  onSelectMode: (mode: DiscoverMode) => void;
}

const MODES: { key: DiscoverMode; label: string; icon: string; description: string }[] = [
  { key: 'genre', icon: '🎸', label: 'Genre / Mood', description: 'Type what you want to discover' },
  { key: 'history', icon: '🕐', label: 'Listening History', description: 'Based on your Spotify taste' },
  { key: 'random', icon: '🎲', label: 'Fully Random', description: 'Completely randomized discovery' },
];

export function DiscoverModeSelector({ onSelectMode }: DiscoverModeSelectorProps) {
  return (
    <View style={{ flex: 1, padding: 24 }}>
      <Text style={{ color: Colors.text.primary, fontSize: 24, fontWeight: '700', marginBottom: 8 }}>
        Discover
      </Text>
      <Text style={{ color: Colors.text.muted, fontSize: 14, marginBottom: 24 }}>
        Choose how you want to find new music
      </Text>
      {MODES.map((m) => (
        <Pressable
          key={m.key}
          onPress={() => onSelectMode(m.key)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            padding: 20,
            backgroundColor: Colors.surface.card,
            borderRadius: 16,
            marginBottom: 12,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ fontSize: 28, marginRight: 16 }}>{m.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: Colors.text.primary, fontSize: 16, fontWeight: '600' }}>
              {m.label}
            </Text>
            <Text style={{ color: Colors.text.muted, fontSize: 13, marginTop: 4 }}>
              {m.description}
            </Text>
          </View>
          <Text style={{ color: Colors.text.muted, fontSize: 18 }}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── DiscoverFeed ──────────────────────────────────────────────────────────────

interface DiscoverFeedProps {
  tracks: SpotifyTrack[];
  onKeep: (track: SpotifyTrack) => void;
  onRemove: (track: SpotifyTrack) => void;
  onHeart: (track: SpotifyTrack) => void;
  onSkip: (track: SpotifyTrack) => void;
}

export function DiscoverFeed({ tracks, onKeep, onRemove }: DiscoverFeedProps) {
  if (tracks.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>✓</Text>
        <Text style={{ color: Colors.text.primary, fontSize: 18, fontWeight: '600' }}>
          You're all caught up!
        </Text>
        <Text style={{ color: Colors.text.muted, fontSize: 14, marginTop: 8, textAlign: 'center' }}>
          No more tracks to review.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16 }}
      renderItem={({ item }) => (
        <View
          style={{
            backgroundColor: Colors.surface.card,
            borderRadius: 16,
            padding: 16,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: Colors.text.primary, fontSize: 15, fontWeight: '600' }}>
              {item.name}
            </Text>
            <Text numberOfLines={1} style={{ color: Colors.text.muted, fontSize: 13, marginTop: 4 }}>
              {item.artists.map((a) => a.name).join(', ')}
            </Text>
            {item.album?.name ? (
              <Text numberOfLines={1} style={{ color: Colors.text.secondary, fontSize: 12, marginTop: 2 }}>
                {item.album.name}
              </Text>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8, marginLeft: 12 }}>
            <Pressable
              onPress={() => onRemove(item)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface.overlay, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 16 }}>✕</Text>
            </Pressable>
            <Pressable
              onPress={() => onKeep(item)}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.brand.primary, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 16 }}>✓</Text>
            </Pressable>
          </View>
        </View>
      )}
    />
  );
}
