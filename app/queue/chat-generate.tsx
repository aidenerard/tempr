import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueueStore } from '@/store';
import { useQueueGeneration } from '@/hooks';
import { Colors } from '@/constants/colors';
import { ChatEditor } from '@/components/chat';
import { QueueHeader, Button } from '@/components/ui';
import { QueueList } from '@/components/queue';
import type { ChatMessage } from '@/types';
import { v4 as uuid } from 'uuid';

export default function ChatGenerateScreen() {
  const insets = useSafeAreaInsets();
  const { generateFromChat, isGenerating } = useQueueGeneration();
  const currentQueue = useQueueStore((s) => s.currentQueue);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const handleSendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: uuid(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const queue = await generateFromChat(content);
        const assistantMsg: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: `Created "${queue.title}" with ${queue.tracks.length} tracks.`,
          timestamp: new Date().toISOString(),
          metadata: { queueId: queue.id },
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const errorMsg: ChatMessage = {
          id: uuid(),
          role: 'assistant',
          content: "Sorry, I couldn't generate a queue. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    },
    [generateFromChat]
  );

  if (currentQueue) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.surface.base }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
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
          <QueueHeader queue={currentQueue} onSavePlaylist={() => {}} />
          <View className="flex-row gap-2 px-4 mb-4">
            <Button
              title="Preview Mode"
              onPress={() => router.push('/queue/preview')}
              variant="secondary"
              size="sm"
            />
            <Button
              title="Save to Spotify"
              onPress={() => {}}
              variant="spotify"
              size="sm"
            />
          </View>
          <QueueList
            tracks={currentQueue.tracks}
            currentlyPlayingId={null}
            onTrackPress={() => {}}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface.base }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
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
        <Text
          style={{
            flex: 1,
            color: Colors.text.primary,
            fontSize: 18,
            fontWeight: '600',
            marginLeft: 16,
            textAlign: 'center',
          }}
        >
          Chat Generate
        </Text>
        <View style={{ width: 48 }} />
      </View>
      <ChatEditor
        messages={messages}
        onSendMessage={handleSendMessage}
        placeholder="Describe the mood or vibe you want..."
        disabled={isGenerating}
      />
    </View>
  );
}
