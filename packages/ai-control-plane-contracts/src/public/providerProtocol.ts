import { expectEnum } from '../validation';

export const PROVIDER_PROTOCOLS = [
  'openai-chat-completions',
  'openai-responses',
  'anthropic-messages',
  'gemini-generate-content',
] as const;

export type ProviderProtocol = (typeof PROVIDER_PROTOCOLS)[number];

export const parseProviderProtocol = (value: unknown): ProviderProtocol =>
  expectEnum(value, PROVIDER_PROTOCOLS, 'providerProtocol');
