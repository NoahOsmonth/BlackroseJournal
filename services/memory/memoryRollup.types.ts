/**
 * Calendar rollups (Memory v3 Phase 4) — week / month / year summaries.
 * Built lazily from day digests → week → month → year. Embeddings enable
 * coarser Phase 3 recall for older history.
 *
 * Storage is SHARDED (one key per rollup + lightweight index) — same reason
 * as session digests (2048-d vectors must not share one AsyncStorage key).
 */

export type MemoryRollupKind = 'week' | 'month' | 'year';

export interface MemoryRollup {
    schemaVersion: number;
    kind: MemoryRollupKind;
    /** week: 2026-W29 · month: 2026-07 · year: 2026 */
    periodKey: string;
    dateFrom: string;
    dateTo: string;
    summary: string;
    topics: string[];
    sourceCount: number;
    createdAt: number;
    updatedAt: number;
}

export interface MemoryRollupIndexEntry {
    id: string;
    kind: MemoryRollupKind;
    periodKey: string;
    dateFrom: string;
    dateTo: string;
    updatedAt: number;
}

export interface MemoryRollupIndex {
    schemaVersion: number;
    entries: MemoryRollupIndexEntry[];
}

export interface MemoryRollupListOptions {
    kind?: MemoryRollupKind;
    from?: string;
    to?: string;
    limit?: number;
}

export interface MemoryRollupStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    multiGet?(keys: readonly string[]): Promise<readonly [string, string | null][]>;
    multiRemove?(keys: readonly string[]): Promise<void>;
    getAllKeys?(): Promise<readonly string[]>;
}
