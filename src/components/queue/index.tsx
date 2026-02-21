import React from 'react';
import { FlatList, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import type { SpotifyTrack } from '../../types';

interface QueueListProps {
  tracks: SpotifyTrack[];
  currentlyPlayingId: string | null;
  onTrackPress: (track: SpotifyTrack) => void;
}

function formatMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export function QueueList({ tracks, currentlyPlayingId, onTrackPress }: QueueListProps) {
  if (tracks.length === 0) {
    return (
      <View style={{ padding: 24, alignItems: 'center' }}>
        <Text style={{ color: Colors.text.muted, fontSize: 14 }}>No tracks in queue</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={tracks}
      keyExtractor={(item) => item.id}
      scrollEnabled={false}
      renderItem={({ item, index }) => {
        const isPlaying = item.id === currentlyPlayingId;
        const durationMs = item.duration_ms ?? item.durationMs ?? 0;
        return (
          <View
            onStartShouldSetResponder={() => { onTrackPress(item); return true; }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: 16,
              paddingVertical: 12,
              backgroundColor: isPlaying ? Colors.surface.card : 'transparent',
              borderBottomWidth: 1,
              borderBottomColor: Colors.surface.overlay,
            }}
          >
            <Text style={{ color: Colors.text.muted, fontSize: 13, width: 28 }}>
              {index + 1}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                numberOfLines={1}
                style={{
                  color: isPlaying ? Colors.brand.primary : Colors.text.primary,
                  fontSize: 15,
                  fontWeight: '500',
                }}
              >
                {item.name}
              </Text>
              <Text numberOfLines={1} style={{ color: Colors.text.muted, fontSize: 13, marginTop: 2 }}>
                {item.artists.map((a) => a.name).join(', ')}
              </Text>
            </View>
            {durationMs > 0 ? (
              <Text style={{ color: Colors.text.muted, fontSize: 13, marginLeft: 12 }}>
                {formatMs(durationMs)}
              </Text>
            ) : null}
          </View>
        );
      }}
    />
  );
}
