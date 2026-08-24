export class ContractValidationError extends Error {
  readonly path: string;

  constructor(path: string, message: string) {
    super(`${path}: ${message}`);
    this.name = 'ContractValidationError';
    this.path = path;
  }
}

export type UnknownRecord = Record<string, unknown>;

export const expectRecord = (value: unknown, path: string): UnknownRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ContractValidationError(path, 'expected an object');
  }
  return value as UnknownRecord;
};

export const expectExactKeys = (
  value: UnknownRecord,
  allowedKeys: readonly string[],
  path: string,
): void => {
  const unexpectedKey = Object.keys(value).find((key) => !allowedKeys.includes(key));
  if (unexpectedKey) {
    throw new ContractValidationError(`${path}.${unexpectedKey}`, 'unexpected field');
  }
};

export const expectString = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ContractValidationError(path, 'expected a non-empty string');
  }
  return value;
};

export const expectBoolean = (value: unknown, path: string): boolean => {
  if (typeof value !== 'boolean') {
    throw new ContractValidationError(path, 'expected a boolean');
  }
  return value;
};

export const expectInteger = (
  value: unknown,
  path: string,
  minimum = 0,
): number => {
  if (!Number.isInteger(value) || (value as number) < minimum) {
    throw new ContractValidationError(path, `expected an integer >= ${minimum}`);
  }
  return value as number;
};

export const expectNumber = (
  value: unknown,
  path: string,
  minimum?: number,
  maximum?: number,
): number => {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    (minimum !== undefined && value < minimum) ||
    (maximum !== undefined && value > maximum)
  ) {
    const range = [minimum ?? '-infinity', maximum ?? 'infinity'].join('..');
    throw new ContractValidationError(path, `expected a finite number in ${range}`);
  }
  return value;
};

export const expectEnum = <T extends string>(
  value: unknown,
  choices: readonly T[],
  path: string,
): T => {
  if (typeof value !== 'string' || !choices.includes(value as T)) {
    throw new ContractValidationError(path, `expected one of: ${choices.join(', ')}`);
  }
  return value as T;
};

export const expectArray = <T>(
  value: unknown,
  path: string,
  parseItem: (item: unknown, path: string) => T,
): T[] => {
  if (!Array.isArray(value)) {
    throw new ContractValidationError(path, 'expected an array');
  }
  return value.map((item, index) => parseItem(item, `${path}[${index}]`));
};

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export const expectJsonValue = (value: unknown, path: string): JsonValue => {
  if (value === null) {
    return null;
  }
  if (typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => expectJsonValue(item, `${path}[${index}]`));
  }
  const record = expectRecord(value, path);
  return Object.fromEntries(
    Object.entries(record).map(([key, item]) => [key, expectJsonValue(item, `${path}.${key}`)]),
  );
};

export const expectJsonObject = (
  value: unknown,
  path: string,
): { [key: string]: JsonValue } => {
  const parsed = expectJsonValue(value, path);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ContractValidationError(path, 'expected a JSON object');
  }
  return parsed;
};

export const includeOptional = <T>(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
  parse: (value: unknown, path: string) => T,
  path: string,
): void => {
  if (value !== undefined) {
    target[key] = parse(value, `${path}.${key}`);
  }
};
