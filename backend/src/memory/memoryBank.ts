import { createHmac } from 'node:crypto';

export interface MemoryBankDeriverOptions {
  key: Uint8Array;
  version: number;
}

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

function encodeBase32(value: Uint8Array): string {
  let bits = 0;
  let buffer = 0;
  let output = '';
  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31];
  return output;
}

export function createMemoryBankDeriver(
  options: MemoryBankDeriverOptions,
): (userId: string) => string {
  const key = Buffer.from(options.key);
  if (key.byteLength < 32) throw new Error('Memory bank HMAC key must be at least 32 bytes.');
  if (!Number.isInteger(options.version) || options.version < 1) {
    throw new Error('Memory bank key version must be a positive integer.');
  }
  return (userId: string): string => {
    if (!userId.trim()) throw new Error('Verified memory bank user id is required.');
    const digest = createHmac('sha256', key).update(userId, 'utf8').digest();
    return `v${options.version}_${encodeBase32(digest)}`;
  };
}
