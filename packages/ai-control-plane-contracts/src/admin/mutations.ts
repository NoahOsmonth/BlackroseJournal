import { ModelCapabilities, parseModelCapabilities } from '../public/catalog';
import { InferencePurpose } from '../public/inference';
import {
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
  parseProviderCredentialInput,
  parseProviderProtocol,
  ProviderCredentialInput,
  ProviderProtocol,
  ProviderState,
} from './provider';

export interface CreateProviderRequest {
  name: string;
  protocol: ProviderProtocol;
  baseUrl: string;
  displayMetadata?: { [key: string]: JsonValue };
  discoveryConfig?: { [key: string]: JsonValue };
  credential: ProviderCredentialInput;
}

export interface UpdateProviderRequest {
  expectedRevision: number;
  name?: string;
  baseUrl?: string;
  state?: Exclude<ProviderState, 'archived'>;
  displayMetadata?: { [key: string]: JsonValue };
  discoveryConfig?: { [key: string]: JsonValue };
}

export interface ExpectedRevisionRequest { expectedRevision: number }
export type ArchiveProviderRequest = ExpectedRevisionRequest;
export type DiscoverProviderRequest = ExpectedRevisionRequest;
export type ArchiveCatalogModelRequest = ExpectedRevisionRequest;

export interface RotateProviderCredentialRequest extends ExpectedRevisionRequest {
  credential: ProviderCredentialInput;
}

export interface PublishCatalogModelRequest extends ExpectedRevisionRequest {
  providerModelId: string;
  label: string;
  publicModelId: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  sortOrder: number;
  purpose: InferencePurpose;
}

export interface UpdateRuntimeSettingsRequest extends ExpectedRevisionRequest {
  flashRouteId: string;
  maxInputBytes: number;
  maxOutputTokens: number;
  requestTimeoutMs: number;
}

export const parseCreateProviderRequest = (value: unknown): CreateProviderRequest => {
  const path = 'createProvider';
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    ['name', 'protocol', 'baseUrl', 'displayMetadata', 'discoveryConfig', 'credential'],
    path,
  );
  const result: Record<string, unknown> = {
    name: expectString(record.name, `${path}.name`),
    protocol: parseProviderProtocol(record.protocol),
    baseUrl: expectString(record.baseUrl, `${path}.baseUrl`),
    credential: parseProviderCredentialInput(record.credential, `${path}.credential`),
  };
  includeOptional(result, 'displayMetadata', record.displayMetadata, expectJsonObject, path);
  includeOptional(result, 'discoveryConfig', record.discoveryConfig, expectJsonObject, path);
  return result as unknown as CreateProviderRequest;
};

export const parseUpdateProviderRequest = (value: unknown): UpdateProviderRequest => {
  const path = 'updateProvider';
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    ['expectedRevision', 'name', 'baseUrl', 'state', 'displayMetadata', 'discoveryConfig'],
    path,
  );
  const result: Record<string, unknown> = {
    expectedRevision: expectInteger(record.expectedRevision, `${path}.expectedRevision`),
  };
  includeOptional(result, 'name', record.name, expectString, path);
  includeOptional(result, 'baseUrl', record.baseUrl, expectString, path);
  includeOptional(result, 'state', record.state, (item, itemPath) =>
    expectEnum(item, ['active', 'disabled'], itemPath), path);
  includeOptional(result, 'displayMetadata', record.displayMetadata, expectJsonObject, path);
  includeOptional(result, 'discoveryConfig', record.discoveryConfig, expectJsonObject, path);
  return result as unknown as UpdateProviderRequest;
};

const parseExpectedRevision = (value: unknown, path: string): ExpectedRevisionRequest => {
  const record = expectRecord(value, path);
  expectExactKeys(record, ['expectedRevision'], path);
  return {
    expectedRevision: expectInteger(record.expectedRevision, `${path}.expectedRevision`),
  };
};

export const parseArchiveProviderRequest = (value: unknown): ArchiveProviderRequest =>
  parseExpectedRevision(value, 'archiveProvider');
export const parseDiscoverProviderRequest = (value: unknown): DiscoverProviderRequest =>
  parseExpectedRevision(value, 'discoverProvider');
export const parseArchiveCatalogModelRequest = (
  value: unknown,
): ArchiveCatalogModelRequest => parseExpectedRevision(value, 'archiveCatalogModel');

export const parseRotateProviderCredentialRequest = (
  value: unknown,
): RotateProviderCredentialRequest => {
  const path = 'rotateProviderCredential';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['expectedRevision', 'credential'], path);
  return {
    expectedRevision: expectInteger(record.expectedRevision, `${path}.expectedRevision`),
    credential: parseProviderCredentialInput(record.credential, `${path}.credential`),
  };
};

export const parsePublishCatalogModelRequest = (
  value: unknown,
): PublishCatalogModelRequest => {
  const path = 'publishCatalogModel';
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    [
      'expectedRevision',
      'providerModelId',
      'label',
      'publicModelId',
      'capabilities',
      'contextWindow',
      'sortOrder',
      'purpose',
    ],
    path,
  );
  return {
    expectedRevision: expectInteger(record.expectedRevision, `${path}.expectedRevision`),
    providerModelId: expectString(record.providerModelId, `${path}.providerModelId`),
    label: expectString(record.label, `${path}.label`),
    publicModelId: expectString(record.publicModelId, `${path}.publicModelId`),
    capabilities: parseModelCapabilities(record.capabilities, `${path}.capabilities`),
    contextWindow: expectInteger(record.contextWindow, `${path}.contextWindow`, 1),
    sortOrder: expectInteger(record.sortOrder, `${path}.sortOrder`),
    purpose: expectEnum(record.purpose, ['chat', 'flash'], `${path}.purpose`),
  };
};

export const parseUpdateRuntimeSettingsRequest = (
  value: unknown,
): UpdateRuntimeSettingsRequest => {
  const path = 'updateRuntimeSettings';
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    [
      'expectedRevision',
      'flashRouteId',
      'maxInputBytes',
      'maxOutputTokens',
      'requestTimeoutMs',
    ],
    path,
  );
  return {
    expectedRevision: expectInteger(record.expectedRevision, `${path}.expectedRevision`),
    flashRouteId: expectString(record.flashRouteId, `${path}.flashRouteId`),
    maxInputBytes: expectInteger(record.maxInputBytes, `${path}.maxInputBytes`, 1),
    maxOutputTokens: expectInteger(record.maxOutputTokens, `${path}.maxOutputTokens`, 1),
    requestTimeoutMs: expectInteger(record.requestTimeoutMs, `${path}.requestTimeoutMs`, 1),
  };
};
