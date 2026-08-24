const REDACTED = '[REDACTED]';
const SENSITIVE_NAMES = [
  'authorization', 'authorizationheader', 'cookie', 'credential', 'credentials',
  'secret', 'clientsecret', 'token', 'accesstoken', 'refreshtoken', 'apikey',
  'providerkey', 'password', 'prompt', 'inputprompt', 'message', 'messages',
  'content', 'systeminstruction',
] as const;
const STRING_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\bsk-(?:or-v1-|nano-)?[A-Za-z0-9_-]{12,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function isSensitiveKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return SENSITIVE_NAMES.some((name) => normalized === name || normalized.endsWith(name));
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
