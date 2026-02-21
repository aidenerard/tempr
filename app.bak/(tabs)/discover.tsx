import React from 'react';
import { View, Text, Pressable, SafeAreaView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDiscoverStore } from '@/store';
import { Colors } from '@/constants/colors';
import { DiscoverModeSelector, DiscoverFeed } from '@/components/discover';

export default function DiscoverTab() {
  const insets = useSafeAreaInsets();
  const { mode, tracks, setMode, reset } = useDiscoverStore();

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: Colors.surface.base,
        paddingTop: insets.top,
      }}
    >
      {!mode ? (
        <DiscoverModeSelector onSelectMode={(m) => setMode(m)} />
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderBottomColor: Colors.surface.overlay,
            }}
          >
            <Text
              style={{
                color: Colors.text.muted,
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              {mode === 'genre'
                ? 'Genre'
                : mode === 'history'
                  ? 'History'
                  : 'Random'}
            </Text>
            <Pressable
              onPress={reset}
              hitSlop={12}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
              }}
            >
              <Text
                style={{
                  color: Colors.brand.primary,
                  fontSize: 14,
                  fontWeight: '600',
                }}
              >
                Reset
              </Text>
            </Pressable>
          </View>
          <DiscoverFeed
            tracks={tracks}
            onKeep={() => {}}
            onRemove={() => {}}
            onHeart={() => {}}
            onSkip={() => {}}
          />
        </>
      )}
    </SafeAreaView>
  );
}
