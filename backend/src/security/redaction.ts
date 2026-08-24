const REDACTED = '[REDACTED]';
const SENSITIVE_TOKENS = new Set([
  'apikey', 'authorization', 'cookie', 'credential', 'credentials', 'content',
  'key', 'message', 'messages', 'password', 'prompt', 'secret', 'secrets',
  'systeminstruction', 'token', 'tokens',
]);
const STRING_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\bsk-(?:or-v1-|nano-)?[A-Za-z0-9_-]{12,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function isSensitiveKey(key: string): boolean {
  const tokens = key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return tokens.some((token) => SENSITIVE_TOKENS.has(token))
    || tokens.some((token, index) => token === 'system' && tokens[index + 1] === 'instruction');
}

function redactString(value: string, opaqueSecrets: readonly string[]): string {
  const patterned = STRING_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, REDACTED),
    value,
  );
  return opaqueSecrets.reduce(
    (redacted, secret) => secret ? redacted.split(secret).join(REDACTED) : redacted,
    patterned,
  );
}

function redactValue(value: unknown, seen: WeakSet<object>, opaqueSecrets: readonly string[]): unknown {
  if (typeof value === 'string') return redactString(value, opaqueSecrets);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return REDACTED;
  seen.add(value);

  if (value instanceof Error) {
    const output: Record<string, unknown> = {
      name: value.name,
      message: redactString(value.message, opaqueSecrets),
    };
    for (const [key, item] of Object.entries(value)) {
      output[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, seen, opaqueSecrets);
    }
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen, opaqueSecrets));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactValue(item, seen, opaqueSecrets);
  }
  return output;
}

export function redactSensitive(value: unknown, opaqueSecrets: readonly string[] = []): unknown {
  return redactValue(value, new WeakSet(), opaqueSecrets);
}
