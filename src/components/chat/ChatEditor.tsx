import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { ChatMessage } from '@/types';
import { Colors } from '@/constants/colors';
import { ChatBubble } from '@/components/ui';

export interface ChatEditorProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const ChatEditor: React.FC<ChatEditorProps> = ({
  messages,
  onSendMessage,
  placeholder = 'Describe how you want to edit the queue...',
  disabled = false,
}) => {
  const [input, setInput] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSendMessage(trimmed);
    setInput('');
  }, [input, onSendMessage, disabled]);

  const keyExtractor = useCallback((item: ChatMessage) => item.id, []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={messages}
        keyExtractor={keyExtractor}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 24,
          flexGrow: 1,
        }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-16">
            <Text
              style={{
                color: Colors.text.muted,
                fontSize: 15,
                textAlign: 'center',
              }}
            >
              Send a message to edit your queue with AI
            </Text>
          </View>
        }
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          padding: 12,
          paddingBottom: 24,
          backgroundColor: Colors.surface.base,
          borderTopWidth: 1,
          borderTopColor: Colors.surface.overlay,
        }}
      >
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          placeholderTextColor={Colors.text.muted}
          multiline
          maxLength={500}
          editable={!disabled}
          style={{
            flex: 1,
            backgroundColor: Colors.surface.raised,
            borderRadius: 24,
            paddingHorizontal: 18,
            paddingVertical: 12,
            paddingRight: 48,
            color: Colors.text.primary,
            fontSize: 16,
            maxHeight: 120,
          }}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || disabled}
          style={({ pressed }) => ({
            position: 'absolute',
            right: 20,
            bottom: 32,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor:
              input.trim() && !disabled
                ? Colors.brand.primary
                : Colors.surface.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text style={{ color: Colors.text.inverse, fontSize: 16 }}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};
