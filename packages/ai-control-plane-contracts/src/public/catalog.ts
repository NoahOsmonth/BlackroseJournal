import {
  expectArray,
  expectBoolean,
  expectEnum,
  expectExactKeys,
  expectInteger,
  expectRecord,
  expectString,
} from '../validation';

export type CatalogModelAvailability = 'available' | 'degraded' | 'unavailable';

export interface ModelCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  jsonObject: boolean;
  jsonSchema: boolean;
}

export interface PublicCatalogModel {
  id: string;
  label: string;
  publicModelId: string;
  capabilities: ModelCapabilities;
  contextWindow: number;
  availability: CatalogModelAvailability;
  sortOrder: number;
  revision: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogResponse {
  revision: number;
  models: PublicCatalogModel[];
}

export const parseModelCapabilities = (
  value: unknown,
  path = 'capabilities',
): ModelCapabilities => {
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    ['streaming', 'tools', 'vision', 'jsonObject', 'jsonSchema'],
    path,
  );
  return {
    streaming: expectBoolean(record.streaming, `${path}.streaming`),
    tools: expectBoolean(record.tools, `${path}.tools`),
    vision: expectBoolean(record.vision, `${path}.vision`),
    jsonObject: expectBoolean(record.jsonObject, `${path}.jsonObject`),
    jsonSchema: expectBoolean(record.jsonSchema, `${path}.jsonSchema`),
  };
};

export const parsePublicCatalogModel = (
  value: unknown,
  path = 'catalogModel',
): PublicCatalogModel => {
  const record = expectRecord(value, path);
  expectExactKeys(
    record,
    [
      'id',
      'label',
      'publicModelId',
      'capabilities',
      'contextWindow',
      'availability',
      'sortOrder',
      'revision',
      'createdAt',
      'updatedAt',
    ],
    path,
  );
  return {
    id: expectString(record.id, `${path}.id`),
    label: expectString(record.label, `${path}.label`),
    publicModelId: expectString(record.publicModelId, `${path}.publicModelId`),
    capabilities: parseModelCapabilities(record.capabilities, `${path}.capabilities`),
    contextWindow: expectInteger(record.contextWindow, `${path}.contextWindow`, 1),
    availability: expectEnum(
      record.availability,
      ['available', 'degraded', 'unavailable'],
      `${path}.availability`,
    ),
    sortOrder: expectInteger(record.sortOrder, `${path}.sortOrder`),
    revision: expectInteger(record.revision, `${path}.revision`),
    createdAt: expectString(record.createdAt, `${path}.createdAt`),
    updatedAt: expectString(record.updatedAt, `${path}.updatedAt`),
  };
};

export const parseCatalogResponse = (value: unknown): CatalogResponse => {
  const record = expectRecord(value, 'catalog');
  expectExactKeys(record, ['revision', 'models'], 'catalog');
  return {
    revision: expectInteger(record.revision, 'catalog.revision'),
    models: expectArray(record.models, 'catalog.models', parsePublicCatalogModel),
  };
};
