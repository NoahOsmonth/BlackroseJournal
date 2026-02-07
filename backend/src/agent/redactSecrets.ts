const SECRET_KEY_PATTERNS: RegExp[] = [
  // OpenAI/OpenRouter style keys.
  /\bsk-[A-Za-z0-9_-]{16,}\b/g,
  // OpenRouter v1 keys.
  /\bsk-or-v1-[A-Za-z0-9_-]{16,}\b/g,
  // NanoGPT keys.
  /\bsk-nano-[A-Za-z0-9_-]{16,}\b/g,
];

export function redactSecrets(text: string): string {
  if (!text) {
    return '';
  }

  let result = text;
  for (const pattern of SECRET_KEY_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }

  return result;
}

