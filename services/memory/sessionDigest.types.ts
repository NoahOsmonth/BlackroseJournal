/**
 * Session digests (Memory v3 Phase 2) — per-finished-session rollup for
 * on-demand temporal/topical recall (Phase 3). NOT injected into every prompt.
 *
 * Storage is SHARDED (one AsyncStorage key per digest + lightweight index).
 * Do not collapse embeddings into a single growing JSON blob — Android's
 * per-key limit (~2MB) would fail after ~100 digests at 2048-d.
 */

export type SessionDigestSourceKind = 'journal_entry' | 'intention_checkin';

export interface SessionDigest {
    schemaVersion: number;
    /** Stable id — usually the journal entry / check-in id. */
    sessionId: string;
    /** Local calendar day YYYY-MM-DD (write/finish day — not event day). */
    dateISO: string;
    /** AI one–two sentence summary. */
    oneLineSummary: string;
    /** AI topic tags, e.g. ["work stress", "family"]. */
    topics: string[];
    /**
     * Absolute ISO date (YYYY-MM-DD) of a specific datable event in the session,
     * when extraction can resolve one (e.g. "dentist on Friday" → next Friday).
     * Absent/null on older shards or undatable sessions — treat as no event date.
     */
    eventDate?: string | null;
    /**
     * L2-normalized embedding of summary (+ topics) from EMBEDDING_MODEL.
     * Empty array if embed failed offline — still keep the text digest.
     */
    embedding: number[];
    entryWordCount: number;
    createdAt: number;
    sourceKind: SessionDigestSourceKind;
    sourceId: string;
}

/** Index row only — no embeddings (cheap enumeration / date filter). */
export interface SessionDigestIndexEntry {
    id: string;
    dateISO: string;
    createdAt: number;
    sourceKind: SessionDigestSourceKind;
    sourceId: string;
}

export interface SessionDigestIndex {
    schemaVersion: number;
    entries: SessionDigestIndexEntry[];
}

export interface SessionDigestListOptions {
    from?: string;
    to?: string;
    limit?: number;
}

export interface SessionDigestStorageAdapter {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    multiGet?(keys: readonly string[]): Promise<readonly [string, string | null][]>;
    multiRemove?(keys: readonly string[]): Promise<void>;
    getAllKeys?(): Promise<readonly string[]>;
}
