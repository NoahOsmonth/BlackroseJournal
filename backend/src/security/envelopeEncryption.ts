import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export interface MasterKey {
  version: number;
  key: Uint8Array;
}

export interface MasterKeyProvider {
  getCurrentKey(): Promise<MasterKey>;
  getKey(version: number): Promise<Uint8Array | null>;
}

export interface EncryptedSecretEnvelopeV1 {
  version: 1;
  algorithm: 'A256GCM';
  keyVersion: number;
  nonce: string;
  ciphertext: string;
  authenticationTag: string;
}

export type EncryptedSecretEnvelope = EncryptedSecretEnvelopeV1;

const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;

function validateKey(key: Uint8Array): Buffer {
  const value = Buffer.from(key);
  if (value.byteLength !== 32) throw new Error('Credential master key is unavailable.');
  return value;
}

function aad(context: string, keyVersion: number): Buffer {
  if (!context) throw new Error('Credential encryption context is required.');
  return Buffer.from(`blackrose:credential:v1:${keyVersion}:${context}`, 'utf8');
}

export async function encryptSecret(
  plaintext: string,
  provider: MasterKeyProvider,
  context: string,
): Promise<EncryptedSecretEnvelopeV1> {
  if (!plaintext) throw new Error('Credential secret is required.');
  const current = await provider.getCurrentKey();
  if (!Number.isInteger(current.version) || current.version < 1) {
    throw new Error('Credential master key version is invalid.');
  }
  const key = validateKey(current.key);
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: AUTH_TAG_BYTES });
  cipher.setAAD(aad(context, current.version));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return {
    version: 1,
    algorithm: 'A256GCM',
    keyVersion: current.version,
    nonce: nonce.toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
    authenticationTag: cipher.getAuthTag().toString('base64url'),
  };
}

function decodeExact(value: string, bytes: number | null): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Credential envelope is invalid.');
  const decoded = Buffer.from(value, 'base64url');
  if (bytes !== null && decoded.byteLength !== bytes) {
    throw new Error('Credential envelope is invalid.');
  }
  return decoded;
}

export async function decryptSecret(
  envelope: EncryptedSecretEnvelope,
  provider: MasterKeyProvider,
  context: string,
): Promise<string> {
  if (
    envelope.version !== 1
    || envelope.algorithm !== 'A256GCM'
    || !Number.isInteger(envelope.keyVersion)
    || envelope.keyVersion < 1
  ) {
    throw new Error('Credential envelope version is unsupported.');
  }
  const resolved = await provider.getKey(envelope.keyVersion);
  if (!resolved) throw new Error('Credential master key is unavailable.');
  const key = validateKey(resolved);
  const nonce = decodeExact(envelope.nonce, NONCE_BYTES);
  const ciphertext = decodeExact(envelope.ciphertext, null);
  const authenticationTag = decodeExact(envelope.authenticationTag, AUTH_TAG_BYTES);
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, nonce, {
      authTagLength: AUTH_TAG_BYTES,
    });
    decipher.setAAD(aad(context, envelope.keyVersion));
    decipher.setAuthTag(authenticationTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('Credential decryption failed.');
  }
}
