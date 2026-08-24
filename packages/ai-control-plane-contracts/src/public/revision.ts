import {
  ContractValidationError,
  expectExactKeys,
  expectInteger,
  expectRecord,
  expectString,
} from '../validation';

export interface RevisionConflict<TState> {
  code: 'revision_conflict';
  message: string;
  currentRevision: number;
  currentState: TState;
}

export type RevisionStateParser<TState> = (value: unknown) => TState;

export const parseRevisionConflict = <TState>(
  value: unknown,
  parseCurrentState: RevisionStateParser<TState>,
): RevisionConflict<TState> => {
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
    currentState: parseCurrentState(record.currentState),
  };
};
