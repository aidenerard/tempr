import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueStore } from '@/store';
import { Colors } from '@/constants/colors';
import { QueueHeader, Button } from '@/components/ui';
import { QueueList } from '@/components/queue';

export default function QueueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const queueHistory = useQueueStore((s) => s.queueHistory);
  const currentQueue = useQueueStore((s) => s.currentQueue);

  const queue =
    currentQueue?.id === id
      ? currentQueue
      : queueHistory.find((q) => q.id === id) ?? null;

  if (!queue) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.surface.base,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text
          style={{
            color: Colors.text.secondary,
            fontSize: 16,
            textAlign: 'center',
          }}
        >
          Queue not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={{
            marginTop: 16,
            paddingHorizontal: 20,
            paddingVertical: 12,
            backgroundColor: Colors.brand.primary,
            borderRadius: 12,
          }}
        >
          <Text style={{ color: Colors.text.inverse, fontWeight: '600' }}>
            Go back
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: Colors.surface.overlay,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: Colors.brand.primary, fontSize: 16 }}>← Back</Text>
        </Pressable>
      </View>
      <ScrollView style={{ flex: 1 }}>
        <QueueHeader
          queue={queue}
          onSavePlaylist={() => {}}
          onEdit={() => router.push('/queue/chat-edit')}
        />
        <View className="flex-row gap-2 px-4 mb-4">
          <Button
            title="Save as Playlist"
            onPress={() => {}}
            variant="spotify"
            size="sm"
          />
          <Button
            title="Edit via Chat"
            onPress={() => router.push('/queue/chat-edit')}
            variant="secondary"
            size="sm"
          />
          <Button
            title="Preview Mode"
            onPress={() => router.push('/queue/preview')}
            variant="secondary"
            size="sm"
          />
        </View>
        <QueueList
          tracks={queue.tracks}
          currentlyPlayingId={null}
          onTrackPress={() => {}}
        />
      </ScrollView>
    </View>
  );
}
