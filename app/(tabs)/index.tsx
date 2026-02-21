import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore, useQueueStore } from '@/store';
import { useSpotifyAuth, useContextSignals, useQueueGeneration } from '@/hooks';
import { Colors } from '@/constants/colors';
import {
  Button,
  QueueHeader,
  LoadingSpinner,
} from '@/components/ui';
import { QueueList } from '@/components/queue';

export default function QueueTab() {
  const insets = useSafeAreaInsets();
  const { signIn, isLoading: authLoading } = useSpotifyAuth();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const currentQueue = useQueueStore((s) => s.currentQueue);
  const { signals, isLoading: contextLoading, refresh } = useContextSignals();
  const {
    generateFromContext,
    isGenerating,
  } = useQueueGeneration();

  const handleAutoGenerate = useCallback(async () => {
    const ctx = signals ?? (await refresh());
    if (ctx) {
      try {
        await generateFromContext(ctx);
      } catch (err) {
        console.error('Auto-generate failed:', err);
      }
    }
  }, [signals, refresh, generateFromContext]);

  const handleRefresh = useCallback(async () => {
    await refresh();
    const ctx = signals ?? (await refresh());
    if (ctx && isAuthenticated) {
      try {
        await generateFromContext(ctx);
      } catch {
        // Ignore - user may not want to overwrite
      }
    }
  }, [refresh, signals, generateFromContext, isAuthenticated]);

  const isLoading = authLoading || contextLoading;

  if (isLoading && !isAuthenticated) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: Colors.surface.base,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LoadingSpinner size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: Colors.surface.base,
          paddingTop: insets.top,
          paddingHorizontal: 24,
        }}
      >
        <View className="flex-1 items-center justify-center">
          <Text style={{ fontSize: 64, marginBottom: 24 }}>♪</Text>
          <Text
            style={{
              color: Colors.text.primary,
              fontSize: 24,
              fontWeight: '700',
              textAlign: 'center',
            }}
          >
            Welcome to Tempr
          </Text>
          <Text
            style={{
              color: Colors.text.secondary,
              fontSize: 16,
              textAlign: 'center',
              marginTop: 12,
              lineHeight: 24,
            }}
          >
            Connect with Spotify to generate personalized music queues
          </Text>
          <View style={{ marginTop: 32 }}>
            <Button
              title="Login with Spotify"
              onPress={signIn}
              variant="spotify"
              size="lg"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentQueue) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: Colors.surface.base,
          paddingTop: insets.top,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingHorizontal: 16,
            paddingTop: 8,
            paddingBottom: 8,
          }}
        >
          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={{ padding: 8 }}
          >
            <Text style={{ color: Colors.text.secondary, fontSize: 18 }}>⚙</Text>
          </Pressable>
        </View>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={isGenerating}
              onRefresh={handleRefresh}
              tintColor={Colors.brand.primary}
            />
          }
        >
          <Text
            style={{
              color: Colors.text.primary,
              fontSize: 22,
              fontWeight: '700',
              marginBottom: 8,
            }}
          >
            Create your queue
          </Text>
          <Text
            style={{
              color: Colors.text.secondary,
              fontSize: 14,
              marginBottom: 24,
            }}
          >
            Choose how you'd like to generate your music queue
          </Text>

          <View className="gap-3">
            <Pressable
              onPress={handleAutoGenerate}
              disabled={isGenerating}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: 20,
                backgroundColor: Colors.surface.card,
                borderRadius: 16,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 28, marginRight: 16 }}>✨</Text>
              <View className="flex-1">
                <Text
                  style={{
                    color: Colors.text.primary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  Auto-Generate
                </Text>
                <Text
                  style={{
                    color: Colors.text.muted,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  Context-based (weather, time, location)
                </Text>
              </View>
              {isGenerating ? (
                <LoadingSpinner size="small" />
              ) : (
                <Text style={{ color: Colors.text.muted, fontSize: 18 }}>›</Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => router.push('/queue/video-upload')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: 20,
                backgroundColor: Colors.surface.card,
                borderRadius: 16,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 28, marginRight: 16 }}>📤</Text>
              <View className="flex-1">
                <Text
                  style={{
                    color: Colors.text.primary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  Upload Video
                </Text>
                <Text
                  style={{
                    color: Colors.text.muted,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  Analyze mood from video
                </Text>
              </View>
              <Text style={{ color: Colors.text.muted, fontSize: 18 }}>›</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/queue/chat-generate')}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                padding: 20,
                backgroundColor: Colors.surface.card,
                borderRadius: 16,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Text style={{ fontSize: 28, marginRight: 16 }}>💬</Text>
              <View className="flex-1">
                <Text
                  style={{
                    color: Colors.text.primary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                >
                  Chat with AI
                </Text>
                <Text
                  style={{
                    color: Colors.text.muted,
                    fontSize: 13,
                    marginTop: 4,
                  }}
                >
                  Describe your mood in natural language
                </Text>
              </View>
              <Text style={{ color: Colors.text.muted, fontSize: 18 }}>›</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: Colors.surface.base }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          paddingHorizontal: 16,
          paddingTop: insets.top + 8,
          paddingBottom: 8,
        }}
      >
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={12}
          style={{ padding: 8 }}
        >
          <Text style={{ color: Colors.text.secondary, fontSize: 18 }}>⚙</Text>
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={isGenerating}
            onRefresh={handleRefresh}
            tintColor={Colors.brand.primary}
          />
        }
      >
        <View>
          <QueueHeader
            queue={currentQueue}
            onSavePlaylist={() => {
              // TODO: Save to Spotify
            }}
            onEdit={() => router.push(`/queue/chat-edit`)}
          />
          <View className="flex-row gap-2 px-4 mb-4">
            <Button
              title="Save to Spotify"
              onPress={() => {}}
              variant="spotify"
              size="sm"
            />
            <Button
              title="Edit Queue"
              onPress={() => router.push('/queue/chat-edit')}
              variant="secondary"
              size="sm"
            />
            <Button
              title="Preview"
              onPress={() => router.push('/queue/preview')}
              variant="secondary"
              size="sm"
            />
          </View>
          <QueueList
            tracks={currentQueue.tracks}
            currentlyPlayingId={null}
            onTrackPress={() => {}}
          />
        </View>
      </ScrollView>
    </View>
  );
}
