const REDACTED = '[REDACTED]';
const SENSITIVE_KEY = /(^|_)(authorization|cookie|credential|secret|token|api_?key|password|prompt|messages?|content|system_?instruction)($|_)/i;
const STRING_PATTERNS: RegExp[] = [
  /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi,
  /\bsk-(?:or-v1-|nano-)?[A-Za-z0-9_-]{12,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
];

function redactString(value: string): string {
  return STRING_PATTERNS.reduce(
    (redacted, pattern) => redacted.replace(pattern, REDACTED),
    value,
  );
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return redactString(value);
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return REDACTED;
  seen.add(value);

  if (value instanceof Error) {
    const output: Record<string, unknown> = {
      name: value.name,
      message: redactString(value.message),
    };
    for (const [key, item] of Object.entries(value)) {
      output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(item, seen);
    }
    return output;
  }
  if (Array.isArray(value)) return value.map((item) => redactValue(item, seen));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactValue(item, seen);
  }
  return output;
}

export function redactSensitive(value: unknown): unknown {
  return redactValue(value, new WeakSet());
}
