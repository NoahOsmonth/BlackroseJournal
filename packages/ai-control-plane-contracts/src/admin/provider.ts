import {
  expectArray,
  expectEnum,
  expectExactKeys,
  expectInteger,
  expectJsonObject,
  expectRecord,
  expectString,
  includeOptional,
  JsonValue,
} from '../validation';
import {
  parseProviderProtocol,
  ProviderProtocol,
} from '../public/providerProtocol';

export { parseProviderProtocol, ProviderProtocol } from '../public/providerProtocol';
export type ProviderState = 'active' | 'disabled' | 'archived';

export interface ProviderCredentialInput {
  secret: string;
  label?: string;
}

export interface ProviderCredentialMetadata {
  label?: string;
  lastFour?: string;
  keyVersion: number;
  updatedAt: string;
}

export interface ProviderDisplayMetadata {
  label: string;
  description?: string;
}

export interface ProviderDiscoveryMetadata {
  modelsPath: string;
}

export interface AdminProvider {
  id: string;
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  state: ProviderState;
  revision: number;
  displayMetadata?: ProviderDisplayMetadata;
  discoveryConfig?: ProviderDiscoveryMetadata;
  credentialMetadata?: ProviderCredentialMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderModelInventoryItem {
  id: string;
  upstreamModelId: string;
  label: string;
  capabilities: { [key: string]: JsonValue };
  contextWindow?: number;
}

export interface DiscoverProviderResponse {
  providerId: string;
  models: ProviderModelInventoryItem[];
  discoveredAt: string;
}

export const parseProviderCredentialInput = (
  value: unknown,
  path = 'providerCredential',
): ProviderCredentialInput => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['secret', 'label'], path);
  const result: Record<string, unknown> = {
    secret: expectString(record.secret, `${path}.secret`),
  };
  includeOptional(result, 'label', record.label, expectString, path);
  return result as unknown as ProviderCredentialInput;
};

const parseCredentialMetadata = (
  value: unknown,
  path: string,
): ProviderCredentialMetadata => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['label', 'lastFour', 'keyVersion', 'updatedAt'], path);
  const result: Record<string, unknown> = {
    keyVersion: expectInteger(record.keyVersion, `${path}.keyVersion`, 1),
    updatedAt: expectString(record.updatedAt, `${path}.updatedAt`),
  };
  includeOptional(result, 'label', record.label, expectString, path);
  includeOptional(result, 'lastFour', record.lastFour, expectString, path);
  return result as unknown as ProviderCredentialMetadata;
};

const parseDisplayMetadata = (
  value: unknown,
  path: string,
): ProviderDisplayMetadata => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['label', 'description'], path);
  const result: Record<string, unknown> = {
    label: expectString(record.label, `${path}.label`),
  };
  includeOptional(result, 'description', record.description, expectString, path);
  return result as unknown as ProviderDisplayMetadata;
};

const parseDiscoveryMetadata = (
  value: unknown,
  path: string,
): ProviderDiscoveryMetadata => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['modelsPath'], path);
  return {
    modelsPath: expectString(record.modelsPath, `${path}.modelsPath`),
  };
};

export const parseAdminProvider = (value: unknown): AdminProvider => {
  const path = 'adminProvider';
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    [
      'id',
      'name',
      'protocol',
      'baseUrl',
      'state',
      'revision',
      'displayMetadata',
      'discoveryConfig',
      'credentialMetadata',
      'createdAt',
      'updatedAt',
    ],
    path,
  );
  const result: Record<string, unknown> = {
    id: expectString(record.id, `${path}.id`),
    name: expectString(record.name, `${path}.name`),
    protocol: parseProviderProtocol(record.protocol),
    baseUrl: expectString(record.baseUrl, `${path}.baseUrl`),
    state: expectEnum(record.state, ['active', 'disabled', 'archived'], `${path}.state`),
    revision: expectInteger(record.revision, `${path}.revision`),
    createdAt: expectString(record.createdAt, `${path}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${path}.updatedAt`),
  };
  includeOptional(result, 'displayMetadata', record.displayMetadata, parseDisplayMetadata, path);
  includeOptional(
    result,
    'discoveryConfig',
    record.discoveryConfig,
    parseDiscoveryMetadata,
    path,
  );
  includeOptional(
    result,
    'credentialMetadata',
    record.credentialMetadata,
    parseCredentialMetadata,
    path,
  );
  return result as unknown as AdminProvider;
};

const parseInventoryItem = (value: unknown, path: string): ProviderModelInventoryItem => {
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    ['id', 'upstreamModelId', 'label', 'capabilities', 'contextWindow'],
    path,
  );
  const result: Record<string, unknown> = {
    id: expectString(record.id, `${path}.id`),
    upstreamModelId: expectString(record.upstreamModelId, `${path}.upstreamModelId`),
    label: expectString(record.label, `${path}.label`),
    capabilities: expectJsonObject(record.capabilities, `${path}.capabilities`),
  };
  includeOptional(result, 'contextWindow', record.contextWindow, (item, itemPath) =>
    expectInteger(item, itemPath, 1), path);
  return result as unknown as ProviderModelInventoryItem;
};

export const parseDiscoverProviderResponse = (value: unknown): DiscoverProviderResponse => {
  const path = 'discoverProviderResponse';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['providerId', 'models', 'discoveredAt'], path);
  return {
    providerId: expectString(record.providerId, `${path}.providerId`),
    models: expectArray(record.models, `${path}.models`, parseInventoryItem),
    discoveredAt: expectString(record.discoveredAt, `${path}.discoveredAt`),
  };
};
