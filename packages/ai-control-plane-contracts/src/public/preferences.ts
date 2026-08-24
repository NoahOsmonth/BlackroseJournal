import {
  ContractValidationError,
  expectExactKeys,
  expectInteger,
  expectRecord,
  expectString,
  includeOptional,
} from '../validation';

export interface UpdateModelPreferenceRequest {
  modelId: string;
  expectedRevision?: number;
}

export interface UserAiPreference {
  selectedModelId: string | null;
  revision: number;
  updatedAt: string;
}

export const parseUpdateModelPreferenceRequest = (
  value: unknown,
): UpdateModelPreferenceRequest => {
  const path = 'preference';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['modelId', 'expectedRevision'], path);
  const result: Record<string, unknown> = {
    modelId: expectString(record.modelId, `${path}.modelId`),
  };
  includeOptional(result, 'expectedRevision', record.expectedRevision, expectInteger, path);
  return result as unknown as UpdateModelPreferenceRequest;
};

export const parseUserAiPreference = (value: unknown): UserAiPreference => {
  const path = 'userAiPreference';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['selectedModelId', 'revision', 'updatedAt'], path);
  const selectedModelId = record.selectedModelId;
  if (selectedModelId !== null && typeof selectedModelId !== 'string') {
    throw new ContractValidationError(`${path}.selectedModelId`, 'expected a string or null');
  }
  return {
    selectedModelId: selectedModelId as string | null,
    revision: expectInteger(record.revision, `${path}.revision`),
    updatedAt: expectString(record.updatedAt, `${path}.updatedAt`),
  };
};
