export const PHASE_0_OWNER_A = '00000000-0000-4000-8000-00000000000a';
export const PHASE_0_OWNER_B = '00000000-0000-4000-8000-00000000000b';

export type IsolationRecordLifecycle = 'active' | 'superseded' | 'deleted';

export interface Phase0IsolationRecord {
    id: string;
    ownerId: string;
    alias: string;
    relationship: string;
    topicWords: readonly string[];
    lifecycle: IsolationRecordLifecycle;
    supersedesId?: string;
}

export interface Phase0IsolationFixture {
    version: 1;
    owners: readonly [string, string];
    records: readonly Phase0IsolationRecord[];
    expectedVisibleIds: Readonly<Record<string, readonly string[]>>;
    forbiddenCrossOwnerIds: Readonly<Record<string, readonly string[]>>;
}

const OWNER_A_ORIGINAL = 'fixture-owner-a-james-original';
const OWNER_A_CURRENT = 'fixture-owner-a-james-corrected';
const OWNER_A_DELETED = 'fixture-owner-a-james-deleted';
const OWNER_B_CURRENT = 'fixture-owner-b-james-current';

export const PHASE_0_ISOLATION_FIXTURE: Phase0IsolationFixture = {
    version: 1,
    owners: [PHASE_0_OWNER_A, PHASE_0_OWNER_B],
    records: [
        {
            id: OWNER_A_ORIGINAL,
            ownerId: PHASE_0_OWNER_A,
            alias: 'James',
            relationship: 'manager',
            topicWords: ['work', 'deadline'],
            lifecycle: 'superseded',
        },
        {
            id: OWNER_A_CURRENT,
            ownerId: PHASE_0_OWNER_A,
            alias: 'James',
            relationship: 'project_lead',
            topicWords: ['work', 'deadline'],
            lifecycle: 'active',
            supersedesId: OWNER_A_ORIGINAL,
        },
        {
            id: OWNER_A_DELETED,
            ownerId: PHASE_0_OWNER_A,
            alias: 'James',
            relationship: 'former_neighbor',
            topicWords: ['work', 'deadline'],
            lifecycle: 'deleted',
        },
        {
            id: OWNER_B_CURRENT,
            ownerId: PHASE_0_OWNER_B,
            alias: 'James',
            relationship: 'cousin',
            topicWords: ['work', 'deadline'],
            lifecycle: 'active',
        },
    ],
    expectedVisibleIds: {
        [PHASE_0_OWNER_A]: [OWNER_A_CURRENT],
        [PHASE_0_OWNER_B]: [OWNER_B_CURRENT],
    },
    forbiddenCrossOwnerIds: {
        [PHASE_0_OWNER_A]: [OWNER_B_CURRENT],
        [PHASE_0_OWNER_B]: [OWNER_A_CURRENT],
    },
};
