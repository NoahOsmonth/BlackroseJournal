import React, { useState, useRef, useCallback } from 'react';
import { View, ScrollView, Keyboard, ActivityIndicator, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../components/Header';
import { ChatMessage } from '../components/ChatMessage';
import { FooterActions } from '../components/FooterActions';
import { InlineTypingInput, InlineTypingInputRef } from '../components/InlineTypingInput';
import { Message, useChat } from '../services/ai';

interface StreamingMessage {
  id: string;
  role: 'assistant';
  content: string;
  reasoning: string;
  isStreaming: boolean;
}

export default function ChatJournalScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<InlineTypingInputRef>(null);
  const { sendMessage, clearMessages } = useChat();

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 200);
  }, []);

  const handleSendMessage = useCallback(async (text: string) => {
    Keyboard.dismiss();
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    scrollToBottom();

    const tempStreamingId = 'streaming-' + Date.now();
    setStreamingMessage({
      id: tempStreamingId,
      role: 'assistant',
      content: '',
      reasoning: '',
      isStreaming: true,
    });

    try {
      await sendMessage(
        text,
        (chunk, reasoning) => {
          setStreamingMessage(prev => prev ? {
            ...prev,
            content: prev.content + chunk,
            reasoning: prev.reasoning + (reasoning || ''),
          } : null);
          scrollToBottom();
        },
        (fullContent, fullReasoning) => {
          setMessages(prev => [
            ...prev,
            {
              id: tempStreamingId,
              role: 'assistant',
              content: fullContent,
              reasoning: fullReasoning,
              timestamp: Date.now(),
            },
          ]);
          setStreamingMessage(null);
          setIsLoading(false);
          scrollToBottom();
          focusInput();
        },
        (error) => {
          console.error('AI Error:', error);
          setStreamingMessage(null);
          setIsLoading(false);
          focusInput();
        }
      );
    } catch {
      setStreamingMessage(null);
      setIsLoading(false);
      focusInput();
    }
  }, [sendMessage, scrollToBottom, focusInput]);

  const handleNewChat = useCallback(() => {
    clearMessages();
    setMessages([]);
    setStreamingMessage(null);
    setIsLoading(false);
    inputRef.current?.clear();
    focusInput();
  }, [clearMessages, focusInput]);

  return (
    <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
      <View className="flex-1 max-w-md mx-auto w-full bg-background-light dark:bg-background-dark">
        <Header />
        
        <ScrollView 
          ref={scrollViewRef}
          className="flex-1 px-6 py-4 space-y-6" 
          contentContainerStyle={{ paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={scrollToBottom}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                isAi={message.role === 'assistant'}
                text={message.content}
                reasoning={message.reasoning}
              />
            ))}
            
            {streamingMessage && (
              <ChatMessage
                key={streamingMessage.id}
                isAi={true}
                text={streamingMessage.content}
                isStreaming={true}
              />
            )}
            
            {isLoading && !streamingMessage && (
              <View className="flex-row items-center gap-2 ml-4">
                <ActivityIndicator size="small" color="#0a7ea4" />
                <Text className="text-slate-500 dark:text-slate-400 text-sm">AI is thinking...</Text>
              </View>
            )}

            {/* Inline typing input - document style */}
            {!isLoading && (
              <InlineTypingInput
                ref={inputRef}
                onSubmit={handleSendMessage}
                disabled={isLoading}
                placeholder="Type your thoughts..."
              />
            )}
          </View>
        </ScrollView>
        
        <FooterActions 
          onNewChat={handleNewChat}
          disabled={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}
