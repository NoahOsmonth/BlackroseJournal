import { useCallback, useRef } from 'react';

const API_BASE_URL = 'https://nano-gpt.com/api/v1';
const API_KEY = 'sk-nano-3d3458af-c1c3-442c-8b2a-80cc8b911146';
const MODEL = 'zai-org/glm-4.7-original:thinking';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  reasoning?: string;
  timestamp: number;
}

export interface StreamingCallback {
  (chunk: string, reasoning?: string): void;
}

export interface CompleteCallback {
  (fullContent: string, fullReasoning: string): void;
}

export interface ErrorCallback {
  (error: Error): void;
}

export async function streamChat(
  messages: Message[],
  onChunk: StreamingCallback,
  onComplete: CompleteCallback,
  onError: ErrorCallback
): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: true,
        temperature: 1.0,
        max_tokens: 16384,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let fullContent = '';
    let fullReasoning = '';

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            onComplete(fullContent, fullReasoning);
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            const content = delta?.content;
            const reasoning = delta?.reasoning || delta?.reasoning_content;
            
            if (content) {
              fullContent += content;
            }
            if (reasoning) {
              fullReasoning += reasoning;
            }
            
            if (content || reasoning) {
              onChunk(content || '', reasoning);
            }
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    }

    onComplete(fullContent, fullReasoning);
  } catch (error) {
    if (error instanceof Error) {
      onError(error);
    } else {
      onError(new Error('Unknown error occurred'));
    }
  }
}

export function useChat() {
  const messagesRef = useRef<Message[]>([]);

  const sendMessage = useCallback(
    async (
      content: string,
      onChunk: StreamingCallback,
      onComplete: CompleteCallback,
      onError: ErrorCallback
    ) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      messagesRef.current = [...messagesRef.current, userMessage];

      await streamChat(
        messagesRef.current,
        onChunk,
        (fullContent, fullReasoning) => {
          const aiMessage: Message = {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: fullContent,
            reasoning: fullReasoning,
            timestamp: Date.now(),
          };
          messagesRef.current = [...messagesRef.current, aiMessage];
          onComplete(fullContent, fullReasoning);
        },
        onError
      );
    },
    []
  );

  const clearMessages = useCallback(() => {
    messagesRef.current = [];
  }, []);

  return {
    sendMessage,
    clearMessages,
  };
}
