export interface RequestCeilings {
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
}

export interface RequestDemand {
  inputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
}

const HARD_LIMITS: RequestCeilings = {
  maxInputBytes: 8 * 1024 * 1024,
  maxOutputTokens: 32_768,
  requestTimeoutMs: 120_000,
};

function positiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
}

export function validateRequestCeilings(value: RequestCeilings): RequestCeilings {
  const ceilings = {
    maxInputBytes: positiveInteger(value.maxInputBytes, 'Input ceiling'),
    maxOutputTokens: positiveInteger(value.maxOutputTokens, 'Output ceiling'),
    requestTimeoutMs: positiveInteger(value.requestTimeoutMs, 'Timeout ceiling'),
  };
  if (
    ceilings.maxInputBytes > HARD_LIMITS.maxInputBytes
    || ceilings.maxOutputTokens > HARD_LIMITS.maxOutputTokens
    || ceilings.requestTimeoutMs > HARD_LIMITS.requestTimeoutMs
  ) throw new Error('Managed request ceiling exceeds a gateway hard limit.');
  return Object.freeze(ceilings);
}

export function enforceRequestCeilings(
  demand: RequestDemand,
  ceilings: RequestCeilings,
): void {
  positiveInteger(demand.inputBytes, 'Input bytes');
  positiveInteger(demand.maxOutputTokens, 'Output tokens');
  positiveInteger(demand.requestTimeoutMs, 'Request timeout');
  if (demand.inputBytes > ceilings.maxInputBytes) throw new Error('Input size exceeds ceiling.');
  if (demand.maxOutputTokens > ceilings.maxOutputTokens) {
    throw new Error('Output token request exceeds ceiling.');
  }
  if (demand.requestTimeoutMs > ceilings.requestTimeoutMs) {
    throw new Error('Request timeout exceeds ceiling.');
  }
}
