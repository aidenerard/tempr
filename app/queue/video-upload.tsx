import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useQueueStore } from '@/store';
import { useQueueGeneration } from '@/hooks';
import { Colors } from '@/constants/colors';
import { QueueHeader, Button, LoadingSpinner } from '@/components/ui';

export default function VideoUploadScreen() {
  const insets = useSafeAreaInsets();
  const { generateFromVideo, isGenerating } = useQueueGeneration();
  const currentQueue = useQueueStore((s) => s.currentQueue);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);

  const pickVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Media library access is needed to select videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
    }
  }, []);

  const recordVideo = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to record videos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      setSelectedUri(result.assets[0].uri);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedUri) return;
    try {
      await generateFromVideo(selectedUri);
    } catch (err) {
      console.error('Video analysis failed:', err);
    }
  }, [selectedUri, generateFromVideo]);

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
        <QueueHeader queue={currentQueue} onSavePlaylist={() => {}} />
        <View className="flex-row gap-2 px-4">
          <Button
            title="Preview Mode"
            onPress={() => router.push('/queue/preview')}
            variant="secondary"
          />
          <Button title="Save to Spotify" onPress={() => {}} variant="spotify" />
        </View>
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
          Upload Video
        </Text>
        <View style={{ width: 48 }} />
      </View>

      <View style={{ flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center' }}>
        {selectedUri ? (
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 200,
                height: 200,
                borderRadius: 16,
                backgroundColor: Colors.surface.card,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 24,
              }}
            >
              <Text style={{ fontSize: 48 }}>🎬</Text>
              <Text style={{ color: Colors.text.secondary, marginTop: 8 }}>Video selected</Text>
            </View>
            {isGenerating ? (
              <LoadingSpinner size="large" label="Analyzing video..." />
            ) : (
              <View className="gap-3" style={{ width: '100%' }}>
                <Button title="Analyze & Generate Queue" onPress={handleAnalyze} variant="primary" size="lg" />
                <Button title="Choose Different Video" onPress={pickVideo} variant="secondary" size="md" />
              </View>
            )}
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Text style={{ fontSize: 64, marginBottom: 16 }}>📹</Text>
            <Text style={{ color: Colors.text.primary, fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
              Upload a video
            </Text>
            <Text style={{ color: Colors.text.muted, fontSize: 14, textAlign: 'center', marginBottom: 24 }}>
              We'll analyze the visual mood and ambient sounds to generate a queue
            </Text>
            <View className="gap-3" style={{ width: '100%' }}>
              <Button title="Choose from Gallery" onPress={pickVideo} variant="primary" size="lg" />
              <Button title="Record Video" onPress={recordVideo} variant="secondary" size="lg" />
            </View>
          </View>
        )}
      </View>
    </View>
  );
}
