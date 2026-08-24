import {
  ContractValidationError,
  expectExactKeys,
  expectInteger,
  expectJsonValue,
  expectRecord,
  expectString,
  JsonValue,
} from '../validation';

export interface RevisionConflict<TState extends JsonValue = JsonValue> {
  code: 'revision_conflict';
  message: string;
  currentRevision: number;
  currentState: TState;
}

export const parseRevisionConflict = (value: unknown): RevisionConflict => {
  const path = 'revisionConflict';
  const record = expectRecord(value, path);
  expectExactKeys(record, ['code', 'message', 'currentRevision', 'currentState'], path);
  if (record.code !== 'revision_conflict') {
    throw new ContractValidationError(`${path}.code`, 'expected revision_conflict');
  }
  return {
    code: 'revision_conflict',
    message: expectString(record.message, `${path}.message`),
    currentRevision: expectInteger(record.currentRevision, `${path}.currentRevision`),
    currentState: expectJsonValue(record.currentState, `${path}.currentState`),
  };
};
