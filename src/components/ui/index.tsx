import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from 'react-native';
import { Colors } from '../../constants/colors';
import type { ChatMessage, GeneratedQueue } from '../../types';

// ── Button ────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'spotify';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
}

const VARIANT_BG: Record<ButtonVariant, string> = {
  primary: Colors.brand.primary,
  secondary: Colors.surface.overlay,
  spotify: '#1DB954',
};

const SIZE_PADDING: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13 },
  md: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 28, fontSize: 17 },
};

export function Button({ title, onPress, variant = 'primary', size = 'md', disabled }: ButtonProps) {
  const bg = VARIANT_BG[variant];
  const { paddingVertical, paddingHorizontal, fontSize } = SIZE_PADDING[size];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: bg,
        paddingVertical,
        paddingHorizontal,
        borderRadius: 12,
        alignItems: 'center' as const,
        opacity: pressed || disabled ? 0.7 : 1,
      })}
    >
      <Text style={{ color: Colors.text.primary, fontSize, fontWeight: '600' }}>
        {title}
      </Text>
    </Pressable>
  );
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  label?: string;
}

export function LoadingSpinner({ size = 'large', label }: LoadingSpinnerProps) {
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <ActivityIndicator size={size} color={Colors.brand.primary} />
      {label ? (
        <Text style={{ color: Colors.text.muted, fontSize: 14 }}>{label}</Text>
      ) : null}
    </View>
  );
}

// ── QueueHeader ───────────────────────────────────────────────────────────────

interface QueueHeaderProps {
  queue: GeneratedQueue;
  onSavePlaylist: () => void;
  onEdit?: () => void;
}

function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

export function QueueHeader({ queue, onEdit }: QueueHeaderProps) {
  return (
    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.surface.overlay }}>
      <Text style={{ color: Colors.text.primary, fontSize: 20, fontWeight: '700' }}>
        {queue.title}
      </Text>
      {queue.description ? (
        <Text style={{ color: Colors.text.muted, fontSize: 13, marginTop: 4 }}>
          {queue.description}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 12 }}>
        <Text style={{ color: Colors.text.secondary, fontSize: 13 }}>
          {queue.tracks.length} tracks · {formatDuration(queue.totalDurationMs)}
        </Text>
        {onEdit ? (
          <Pressable onPress={onEdit} hitSlop={8}>
            <Text style={{ color: Colors.brand.primary, fontSize: 13, fontWeight: '600' }}>
              Edit
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── ChatBubble ────────────────────────────────────────────────────────────────

interface ChatBubbleProps {
  message: ChatMessage;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === 'user';
  return (
    <View
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        maxWidth: '80%',
        marginVertical: 4,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 18,
        borderBottomRightRadius: isUser ? 4 : 18,
        borderBottomLeftRadius: isUser ? 18 : 4,
        backgroundColor: isUser ? Colors.brand.primary : Colors.surface.card,
      }}
    >
      <Text style={{ color: Colors.text.primary, fontSize: 15, lineHeight: 21 }}>
        {message.content}
      </Text>
    </View>
  );
}
