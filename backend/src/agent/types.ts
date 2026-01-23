export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  memoryNamespace?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatCompletionResult {
  content: string;
  reasoning?: string;
}

export interface AskRosebudRequest {
  question: string;
  timeRange: 'all-time' | 'this-year' | 'this-month' | 'this-week';
  memoryNamespace?: string;
}
