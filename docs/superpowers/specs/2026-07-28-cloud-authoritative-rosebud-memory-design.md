# Cloud-Authoritative Rosebud Memory System

**Status:** Approved quality-first design, research-revised and ready for implementation planning

**Date:** 2026-07-28

**Product:** BlackroseJournal / Rosebud

**Audience:** Personal use and a small invite-only circle of trusted friends

**Positioning:** A journaling companion with therapist-like conversational skill; not a clinical mental-health product

**Primary objective:** Maximum-quality longitudinal continuity and conversational judgment. Cost is observable but is not a quality-routing constraint; latency, privacy, evidence sufficiency, and conversational value remain constraints.

## 1. Executive summary

Rosebud will move from a phone-local memory system to a cloud-authoritative memory platform. The cloud will own completed conversations, message evidence, changing facts, people and aliases, episodes, open threads, interaction preferences, source-linked summaries, search indexes, embeddings, rollups, background jobs, and deletion state. The phone will retain the current rendered conversation, encrypted offline drafts and outbox events, a bounded cache, authentication state, and user-facing memory controls.

The design is evidence-first. Exact user-authored messages are the authoritative source. Facts and relationships are temporal claims with explicit validity, observation time, confidence, evidence, counterevidence, and lifecycle status. Embeddings, digests, rollups, graph edges, user summaries, and patterns are rebuildable projections rather than permanent truth. Assistant-authored text and repeated model interpretations can never become evidence about the user.

Every conversational turn follows an adaptive live pipeline:

1. Persist the user message and a durable outbox event.
2. Run a small structured Memory Scout.
3. Classify the required evidence set, memory-dependence posture, and whether external facts require live refresh.
4. Search cloud memory through exhaustive-recent, entity, lexical, semantic, graph, temporal, structured-claim, open-thread, and preference routes.
5. Fuse candidates with Reciprocal Rank Fusion, apply a strong reranker, and expand exact surrounding evidence.
6. Verify target coverage, supersession chains, counterevidence, freshness, and source authorization; iterate when a quality-first route remains incomplete.
7. Decide separately whether each memory should be ignored, used silently, used implicitly, mentioned, or verified first.
8. Fuse the result into a source-linked Turn Blackboard organized by epistemic plane.
9. Route through the normal two-call path or an adaptive deep route with bounded evidence-expansion and optional specialist calls.
10. Let Primary Rosebud produce the only user-visible response.
11. Run deterministic response checks and schedule asynchronous curation.

Normal conversation still targets two model calls: Memory Scout and Primary Rosebud. Complex memory-sensitive turns are governed by an evidence-sufficiency and latency budget rather than an absolute three-call law. They may use a planning or verification call, two to four retrieval-expansion cycles, and either the Deep Formulation Consultant or separately enabled Private Differential before Primary Rosebud. The Turn Orchestrator remains deterministic software, and no background or specialist role may speak to the user.

Rosebud receives an always-on temporal orientation pack of approximately 3,000–5,000 tokens plus approximately 2,000–3,000 tokens of tool definitions. This is a baseline orientation layer, not the maximum memory context. The pack includes the exact local clock, identity core, current-life snapshot, interaction policy, recent context, this week, last week, a non-duplicative two-week delta, month-to-date direction, open threads, changing or uncertain facts, and turn-specific evidence. When exact discourse, multi-message evidence, or recent-history completeness matters, an adaptive evidence window may contribute approximately 8,000–24,000 additional source tokens on a verified large-context model. Tools remain available for exact source retrieval. Cached projections allow software to assemble the baseline pack without an additional live model call.

The memory substrate is an evidence constitution rather than one ranked list. Immutable source evidence, truth-authorized temporal claims, synthesized observations, scoped preferences, and bounded hypotheses remain structurally distinct. A retrieved summary or pattern can guide exploration but cannot authorize a factual assertion. Current world facts such as officeholders, laws, schedules, prices, or product status use a separate live-fact lane with provenance, freshness, and expiry; autobiographical memory preserves what was said and when without pretending it remains externally current.

The background system uses durable typed jobs rather than an always-running autonomous swarm. Cheap capture occurs on every accepted message. Session curation, reconciliation, embeddings, temporal summaries, outcome observation, pattern review, and period rollups run at lifecycle boundaries or in the background. Jobs are idempotent, retryable, traceable, replayable, version-fenced, and visible when dead-lettered.

The migration will proceed through LOCAL, MIRROR, SHADOW, and CLOUD authority states on a per-user basis. Existing local evidence remains intact while the cloud imports, rebuilds, and shadow-compares its results. The phone’s heavy local memory stores are retired only after source parity, longitudinal recall, deletion, live-provider E2E, and human conversational-quality gates pass.

## 2. Why the current architecture is insufficient

The existing local system is valuable and should be treated as the migration source, but it does not reliably satisfy the intended one-year companion promise.

Observed architectural limitations include:

- The local memory capsule can be ranked from the previous message instead of the current turn.
- An ordinary mention of a person does not reliably trigger deep history retrieval.
- Several topical searches operate on recent slices rather than the full archive.
- Entry deletion does not have a universal dependency graph that invalidates every atom, identity field, digest, session record, embedding, rollup, and cache.
- Day digest behavior can conflate write date and event date and can replace earlier same-day material.
- Changing scalar identity facts are handled better than changing relationships, events, and multi-valued facts.
- The current stores do not provide a general bitemporal representation of current truth versus historical truth.
- Local embeddings may still send text to a remote provider, making “local” an incomplete privacy description.
- Year rollup storage exists, but year-scale implicit recall is not reliably available on every relevant turn.
- AsyncStorage storage and background processing place growing responsibility on the phone.
- Debugging multi-stage extraction failures on a mobile device is difficult.
- Unit tests demonstrate that mechanisms work in isolation, but do not prove longitudinal conversational behavior.

The cloud design is therefore not a remote copy of the existing atom store. It replaces the truth model, retrieval contract, curation lifecycle, observability, and deletion semantics while preserving the best parts of the current shared chat engine and prompt discipline.

## 3. Goals

### 3.1 Product goals

- Remember at least one year of conversations and journals without dumping full history into every prompt.
- Resolve people, aliases, changing relationships, projects, places, routines, preferences, and open threads.
- Understand vague continuity such as “he did it again” or “that thing from last month” when evidence supports a likely interpretation.
- Preserve current truth and historical truth without overwriting the past.
- Use sensitive history with restraint; relevance alone must not force an explicit mention.
- Adapt response length, question count, advice mode, directness, warmth, pacing, and memory posture from user feedback.
- Make ordinary day-sharing, joy, humor, resilience, and growth as retrievable as conflict and trauma.
- Use memory strategically: a relevant memory may shape the response silently, be mentioned naturally, require verification, or be withheld.
- Preserve exact recent conversational evidence when it is more reliable than early lossy retrieval.
- Distinguish what the user said, what Rosebud may assert, what the system synthesized, and what remains only a hypothesis.
- Refresh changing external-world facts at answer time instead of treating old conversation content as current reality.
- Keep the user-facing experience as one natural companion rather than an agent committee.
- Reduce phone storage, background work, and provider orchestration.
- Make extraction, retrieval, routing, cost, failures, and deletion inspectable on the backend.

### 3.2 Engineering goals

- Make raw user-authored evidence the only authoritative source for autobiographical claims.
- Make all derived memory source-linked, versioned, and rebuildable.
- Guarantee idempotent capture and durable background scheduling.
- Separate event time, mention time, claim validity time, and system observation time.
- Provide hybrid retrieval over the complete eligible archive.
- Assemble a bounded 3,000–5,000-token temporal orientation pack each turn without a new model call.
- Add an adaptive exact-evidence window for recent, multi-message, and high-consequence continuity.
- Keep the normal live route at two model calls while allowing a bounded, evidence-sufficient deep route.
- Measure extraction, update, retrieval, utilization, mention restraint, proactive recall, and conversational benefit as separate quality stages.
- Use Supabase Postgres, full-text search, and pgvector as the initial small-deployment data platform.
- Reuse the existing Node backend as a modular monolith for orchestration and workers.
- Preserve UI → hooks → services layering and the shared `useChatOrchestration` chat stack.
- Provide per-user migration and feature flags with safe forward-repair behavior.

## 4. Non-goals

- Positioning Rosebud as a therapist, clinician, diagnostic service, treatment provider, or crisis-care replacement.
- Creating a covert permanent diagnostic dossier.
- Allowing model-written text to become user truth.
- Autonomous prompt rewriting, self-modifying code, unsupervised fine-tuning, or learned policy outside typed and reversible records.
- Optimizing for time spent, message count, disclosure volume, emotional intensity, or dependence.
- Running every logical role as an independent always-on model agent.
- Full server-blind end-to-end encryption; cloud agents require temporary access to evidence.
- Enterprise compliance, multi-region residency, per-user KMS hierarchies, or large-team operational controls in the trusted-circle release.
- Permanent dual local/cloud authority.
- A new third chat surface or a fork of the shared chat orchestration engine.

## 5. Approved architecture decisions

| Concern | Decision |
|---|---|
| Memory authority | Cloud-authoritative raw evidence and derived memory |
| Mobile responsibility | Current conversation, encrypted draft/outbox, bounded cache, auth, controls |
| Cloud platform | Supabase Postgres + full-text search + pgvector |
| Application backend | Existing Node backend evolved into a modular monolith |
| Background execution | Durable typed Postgres-backed jobs with bounded workers |
| Truth model | Evidence-first and bitemporal |
| Retrieval | Evidence-set planning, exhaustive-recent lane, progressive hybrid retrieval, RRF, reranking, and coverage verification |
| Epistemic contract | Source evidence, authorized claims, observations, preferences, and hypotheses remain separate |
| Always-on context | 3–5k temporal orientation pack plus approximately 2–3k of tools; adaptive 8–24k exact-evidence window |
| Live model calls | Two normally; bounded quality-first deep loop when evidence is incomplete |
| User-facing speaker | Primary Rosebud only |
| Interaction learning | Consent-aware Preference Ledger with bounded outcome learning |
| Formulation | Plural, evidence-bound, advisory Deep Formulation Consultant |
| Diagnostic reasoning | Optional ephemeral Private Differential with explicit opt-in |
| Curation | Always-durable capture plus tiered background curation |
| Security | Lean trusted-circle baseline |
| Cost | Observed and attributed, never used to reduce answer or memory quality |
| Migration | Mirror → rebuild → shadow → staged cutover |
| Verification | Longitudinal evidence gates and progressive release |

### 5.1 Best-of synthesis, not framework transplant

Rosebud combines mechanisms only where they strengthen the product’s evidence constitution and conversational purpose:

- From Hindsight: distinct epistemic networks, temporal/entity links, multi-route retrieval, RRF, reranking, and reflection over evidence.
- From MemIR: only source-backed claims may authorize facts.
- From APEX-MEM: append-only temporal history and retrieval-time resolution of conflicts.
- From MemMachine: preserve full episodes and expand exact surrounding turns.
- From ConvoMem: exploit exhaustive recent context before lossy retrieval becomes superior.
- From AdaMem and MemORAI: target-aware routing and query-adaptive graph expansion.
- From MemCog and proactive-memory research: memory access can be reasoning-driven and may correctly choose silence instead of always injecting history.
- From DCPM: immediate evidence capture plus asynchronous schema/collision review.
- From SteeM, RPEval, and BenchPreS: control how strongly and where memory applies.
- From A-MBER, ENPMR-Bench, and StratMem-Bench: judge memory by emotional usefulness, strategic restraint, and response quality, not recall alone.

The design deliberately does not adopt:

- autonomous model permission to discard raw evidence or rewrite truth;
- an agent’s evolving opinion as a fact about the user;
- irreversible learned memory policies before their writes can be audited and rebuilt;
- aggressive storage gating when personalized gating remains unreliable;
- six or more memory types merely to imitate another framework;
- full-context injection of an entire year;
- a live multi-agent discussion on every ordinary message;
- leaderboard optimization against one benchmark, model, prompt, or judge.

## 6. System invariants

These are architectural laws, not tuning preferences.

1. **User-authored evidence only.** A fact about the user must trace to an eligible user-authored message revision or an explicit user action.
2. **Assistant text is never evidence.** A model repeating an idea cannot increase its confidence.
3. **Current messages outrank memory.** The current user turn can correct or supersede retrieved history.
4. **Explicit preferences outrank inferred preferences.**
5. **Facts are temporal.** Current, historical, disputed, retracted, and candidate claims remain distinguishable.
6. **Event and mention dates remain separate.**
7. **Retrieval is not permission to mention.** Mention value and sensitivity are evaluated after relevance.
8. **Patterns are hypotheses, never diagnoses or identity.**
9. **Private differential output never enters durable autobiographical memory.**
10. **Raw journal content is untrusted data, never executable instruction.**
11. **Primary Rosebud is the only user-facing model role.**
12. **The normal route targets two model calls; the complex route is bounded by evidence sufficiency, latency, permissions, and model health rather than cost or a universal three-call ceiling.**
13. **Background failure cannot erase the source or its work request.**
14. **Every background mutation is idempotent and version-fenced.**
15. **Editing or deleting source evidence immediately removes retrieval eligibility and invalidates dependents.**
16. **Derived artifacts record model, prompt, schema, job, and input versions.**
17. **No cross-user evidence can appear in queries, prompts, exports, or responses.**
18. **Response generation reserves cannot be consumed by memory injection.**
19. **No natural-language keyword routing.** Semantic interpretation comes from structured models; deterministic logic is limited to validation, authorization, budgets, deadlines, and policy.
20. **The system does not optimize for dependence or engagement.**
21. **Factual authorization is typed.** Only current user evidence and supported claim/event records may authorize autobiographical assertions; retrieval cues, summaries, preferences, and hypotheses cannot.
22. **Recent exact evidence is not discarded prematurely.** The system benchmarks exhaustive recent context against retrieval and may use both.
23. **Memory relevance is not memory applicability.** A separate utilization decision controls whether memory is ignored, silently influential, implicit, explicit, or verification-only.
24. **External-world freshness is separate from autobiographical memory.** Dynamic world facts require live provenance and expiry.
25. **Deep retrieval is coverage-seeking.** Multi-target turns are not answer-ready until required targets, revision chains, and material counterevidence are covered or explicitly marked insufficient.

## 7. System topology

```mermaid
flowchart LR
    A["Expo app<br/>current chat, offline outbox, bounded cache"] --> B["Rosebud API<br/>auth, turn capture, streaming"]
    B --> C["Supabase Postgres<br/>evidence, truth, projections, jobs"]
    B --> D["Turn Orchestrator<br/>deterministic budgets and routing"]
    D --> E["Memory Scout"]
    D --> F["Evidence-Set Planner<br/>recent, lexical, semantic, graph, temporal"]
    F --> C
    F --> O["Authoritative Live Sources<br/>fresh external-world facts"]
    O --> F
    F --> L["Fusion and Reranking<br/>RRF plus strong reranker"]
    L --> M["Coverage and Freshness Verifier"]
    M -->|"Incomplete"| F
    M --> N["Memory Utilization Controller"]
    D --> G["Optional Specialist<br/>formulation or private differential"]
    D --> H["Primary Rosebud"]
    E --> D
    G --> D
    N --> D
    H --> B
    C --> I["Bounded Background Workers"]
    I --> J["Model Gateway"]
    D --> J
    J --> K["Allowlisted AI Providers"]
    I --> C
```

The backend remains one deployable service initially. “Scout,” “Curator,” “Reconciler,” and similar terms describe logical roles and job handlers, not independently deployed microservices.

## 8. Runtime ownership

### 8.1 Phone

The phone owns:

- Current rendered conversation state.
- Encrypted draft text and attachments not yet accepted by the server.
- A serialized, encrypted network outbox with stable client event IDs.
- A bounded recent-response and context cache.
- Authentication session state.
- Network and sync status.
- User-facing memory, preference, privacy, export, and deletion controls.
- A read-only migration snapshot during the cutover observation window.

The phone does not own after cutover:

- Durable full transcripts.
- Ranked memory atoms.
- Identity profile truth.
- Day, session, week, month, or year memory projections.
- Embedding indexes.
- Full-history search.
- Memory extraction or rollup workers.
- Provider routing for the primary cloud companion path.

### 8.2 Rosebud backend

The backend owns:

- Supabase JWT verification and per-request owner scoping.
- Turn acceptance and durable transactional outbox writes.
- Streaming orchestration.
- Memory Scout invocation.
- Context-pack assembly.
- Hybrid retrieval and evidence fusion.
- Adaptive route selection.
- Model/provider gateway.
- Background worker leases, retries, replay, and dead letters.
- Curation, reconciliation, embedding, summaries, rollups, and deletion.
- Trace metadata, cost, latency, and benchmark versioning.

### 8.3 Supabase Postgres

Postgres owns:

- Authoritative source records.
- Temporal claims and evidence links.
- Derived projections and dependency links.
- Full-text and vector indexes.
- User settings and memory authority state.
- Durable job queue and attempts.
- Migration manifests and verification state.
- Tombstones and deletion verification.

## 9. Data model

All tables containing user data include `owner_id`, use RLS, and are accessed through owner-scoped backend repositories. Applied migrations are never edited; the cloud memory schema is introduced through new migration files.

### 9.1 Source evidence

#### `memory_conversations`

| Field | Purpose |
|---|---|
| `id` | Stable conversation ID preserved across migration |
| `owner_id` | Supabase user |
| `source_kind` | `journal`, `freeform_chat`, `intention_checkin`, or future source |
| `source_record_id` | Optional existing entry/check-in ID |
| `status` | `draft`, `active`, `settled`, `deleted` |
| `started_at` | UTC instant |
| `settled_at` | UTC instant, nullable |
| `timezone` | IANA timezone observed at start |
| `week_starts_on` | User calendar preference snapshot |
| `client_schema_version` | Source serialization version |
| `source_hash` | Canonical source hash |
| `created_at`, `updated_at`, `deleted_at` | Lifecycle timestamps |

#### `memory_messages`

| Field | Purpose |
|---|---|
| `id` | Stable message ID |
| `owner_id`, `conversation_id` | Ownership and parent |
| `client_event_id` | Retry-safe unique ID per owner |
| `role` | `user`, `assistant`, `system`, `tool` |
| `sequence` | Stable order within conversation |
| `authored_at` | UTC instant |
| `authored_timezone` | IANA zone at authorship |
| `local_date` | Derived local calendar date |
| `content` | Current visible content |
| `content_hash` | Integrity and idempotency |
| `revision` | Monotonic source revision |
| `status` | `active`, `edited`, `deleted` |
| `created_at`, `updated_at`, `deleted_at` | System lifecycle |

The unique constraint is `(owner_id, client_event_id)`. A retry returns the previously accepted record instead of creating a duplicate.

The existing `journal_entries.messages` and `intention_checkins.messages` JSONB fields remain compatibility projections during migration; they do not become a second writable transcript authority. In CLOUD state, normalized `memory_messages` are authoritative for AI evidence. Journal/check-in rows retain product metadata such as title, emoji, status, intention, and summary, while their legacy message arrays are derived or retired through a later additive migration.

#### `memory_message_revisions`

Every edit creates an immutable revision containing the prior content, content hash, authored metadata, and lifecycle reason. Only the current eligible revision is used for retrieval. Revision history supports correction audits and deterministic dependent invalidation.

#### `memory_evidence_spans`

| Field | Purpose |
|---|---|
| `id` | Evidence ID |
| `owner_id`, `message_revision_id` | Source |
| `start_offset`, `end_offset` | Exact span |
| `span_hash` | Integrity without requiring duplicate plaintext in logs |
| `evidence_kind` | `explicit_statement`, `explicit_correction`, `explicit_preference`, `episode_description`, etc. |
| `eligibility` | `eligible`, `withheld`, `deleted`, `expired` |
| `created_by_job_id` | Producing job |

Only spans from user-authored revisions can support autobiographical claims. Assistant spans may be stored for conversation reconstruction but are ineligible as user evidence.

### 9.2 Entities and aliases

#### `memory_entities`

Represents people, organizations, places, projects, pets, roles, and other reference targets. An entity is a reference anchor, not a bag of unquestioned properties.

Core fields:

- `id`, `owner_id`
- `entity_type`
- `display_name`
- `status`: `candidate`, `active`, `merged`, `split`, `deleted`
- `confidence`
- `created_from_evidence_id`
- `merged_into_id`
- timestamps and version

#### `memory_entity_aliases`

Stores names, nicknames, pronoun descriptions, relationship descriptions such as “my ex,” and context-dependent aliases. Each alias includes evidence, confidence, validity, and ambiguity state. Two people with the same name remain separate until evidence justifies a merge.

#### `memory_relationship_edges`

Provides the typed graph used for relation-aware expansion:

| Field | Purpose |
|---|---|
| `from_kind`, `from_id`, `to_kind`, `to_id` | Typed endpoints |
| `edge_type` | `entity`, `temporal`, `semantic`, `supports`, `contradicts`, `supersedes`, or `causal_candidate` |
| `valid_from`, `valid_to`, `observed_at` | Temporal semantics |
| `evidence_id` | Direct source when the edge carries factual meaning |
| `confidence`, `status` | Candidate, active, disputed, historical, deleted |
| `epistemic_role` | Navigation-only versus fact-supporting |
| `producing_job_id`, `model_version`, `schema_version` | Provenance |

Semantic-similarity and temporal-proximity edges are navigation aids only. A `causal_candidate` remains a bounded hypothesis unless the user explicitly stated the causal relationship. Graph traversal can discover evidence but cannot upgrade an edge’s factual authority.

### 9.3 Bitemporal claims

#### `memory_claims`

| Field | Purpose |
|---|---|
| `id`, `owner_id` | Identity |
| `subject_kind`, `subject_id` | User or entity |
| `predicate` | Typed relation |
| `object_kind`, `object_value`, `object_entity_id` | Typed value |
| `valid_from`, `valid_to` | When the claim is true in the user’s world |
| `observed_at` | When Rosebud learned it |
| `recorded_at` | Database transaction time |
| `confidence` | Calibrated confidence |
| `explicitness` | `explicit`, `strong_inference`, `weak_inference` |
| `status` | `candidate`, `current`, `historical`, `disputed`, `retracted`, `deleted` |
| `sensitivity` | Mention/retrieval handling |
| `supersedes_claim_id` | Explicit temporal chain |
| `producing_job_id`, `model_version`, `schema_version` | Provenance |

#### `memory_claim_evidence`

Links a claim to supporting or counterevidence spans with a relationship type and contribution weight. Model-generated descriptions are never accepted as claim evidence.

An explicit correction can close the old claim’s `valid_to`, create a current claim, and retain the old claim as historical. Ambiguous correction creates a disputed candidate and prevents confident assertion until reconciled.

### 9.4 Episodes

#### `memory_episodes`

Represents events and experiences rather than timeless facts.

Core fields:

- `id`, `owner_id`
- short source-grounded summary
- `event_started_at`, `event_ended_at`
- `event_time_precision`: exact, day, week, month, relative, unknown
- `event_time_confidence`
- `mentioned_at`
- local timezone/calendar metadata
- emotional context without diagnostic labels
- importance axes: practical relevance, relationship relevance, unfinishedness, positive salience, adversity salience, recency
- sensitivity and mention posture
- status and lifecycle version

#### `memory_episode_entities`

Links participants, places, projects, and roles to episodes. Links include confidence and evidence.

### 9.5 Open threads

#### `memory_open_threads`

Tracks upcoming, unresolved, postponed, completed, dismissed, and no-longer-relevant matters.

Fields include:

- title and source-grounded description
- status
- due/event time and precision
- `follow_up_allowed`
- `do_not_nag`
- last mentioned time
- next eligible reminder time
- completion/dismissal evidence
- sensitivity

Open threads guide continuity but never authorize unsolicited reminders when `do_not_nag` or a boundary applies.

### 9.6 Interaction Preference Ledger

#### `interaction_preferences`

| Field | Purpose |
|---|---|
| `key` | Length, question budget, advice mode, directness, warmth, pacing, memory posture, etc. |
| `value` | Typed JSON validated by preference schema |
| `scope_kind` | `global`, `session`, `situation`, `topic`, `time_window` |
| `scope_value` | Typed matcher, never raw executable text |
| `source_kind` | `explicit`, `corroborated`, `inferred` |
| `confidence` | Authority and conflict resolution |
| `valid_from`, `expires_at` | Lifecycle |
| `status` | `candidate`, `active`, `weakened`, `revoked`, `expired` |
| `evidence_id` | User-authored source |

The current turn has highest authority, followed by explicit durable preferences, explicit contextual preferences, corroborated candidates, inferred candidates, and product defaults.

#### `interaction_outcomes`

Stores cautious observations such as explicit correction, “that helped,” regenerate/edit, repeated frustration, and next-turn feedback. It does not store an engagement reward. Outcome processing may strengthen, weaken, narrow, expire, or propose confirmation of a preference; it cannot rewrite prompts or model weights.

### 9.7 Pattern hypotheses

#### `memory_pattern_hypotheses`

Pattern hypotheses include:

- neutral source-grounded description
- scope and time window
- confidence
- minimum support episode count
- next review date
- decay rule
- status: candidate, active, weakened, dismissed, expired, deleted
- producing model/prompt/schema versions

#### `memory_pattern_evidence`

Requires separate support and counterexample links. A pattern cannot become active without multiple distinct episodes and at least an explicit counterevidence search. Patterns cannot contain diagnoses or become identity fields.

### 9.8 Rebuildable projections

#### `memory_temporal_digests`

Supports:

- session digest
- local calendar day
- week-to-date
- completed week
- rolling two-week delta
- month-to-date
- completed month
- year
- current-life snapshot
- identity projection
- open-thread projection

Each digest stores:

- period boundaries and timezone
- source conversation/message/episode IDs
- content
- source hash aggregate
- model/prompt/schema versions
- build job ID
- freshness status
- invalidation version
- token estimate

The two-week delta describes changes and persistence between periods instead of repeating both weekly summaries. Month-to-date contributes the broader arc and older material rather than restating current-week detail.

#### `memory_profile_nodes`

Maintains a bounded, source-linked profile tree for low-latency orientation:

- fixed top-level branches: identity, important people, roles, projects, routines, preferences, communication style, and open threads;
- nested nodes for scoped detail rather than an ever-growing flat profile;
- `ADD`, `UPDATE`, `SUPERSEDE`, `WITHHOLD`, and `NO_OP` projection operations;
- validity, confidence, sensitivity, source claim/evidence IDs, and freshness on every node;
- explicit maximum depth and per-branch token budgets.

The tree is a synthesized observation plane, not source truth. A profile node must resolve through claims to original evidence before Primary Rosebud can state it as fact. Rebuild may replace the whole tree without changing source evidence or bitemporal history.

#### `memory_search_documents`

Search documents normalize eligible source messages, episodes, claims, digests, and open threads for:

- Postgres full-text search.
- pgvector semantic search.
- entity and alias joins.
- temporal filters.
- sensitivity and deletion filters.

Each record includes a content hash, source pointer, projection kind, embedding model/version, and eligibility state.

#### `memory_dependencies`

Represents derived-artifact dependency edges. Every projection links to its source evidence and upstream projections. Edit and deletion traverse this graph to remove retrieval eligibility immediately and schedule rebuilds.

#### `memory_context_snapshots`

Caches versioned context-pack blocks, not one opaque prompt. Blocks can be independently invalidated and reassembled.

### 9.9 Epistemic representation contract

Every object exposed to retrieval carries an `epistemic_role`:

| Role | Meaning | Factual authority |
|---|---|---|
| `source_evidence` | Exact eligible user-authored message revision or span | Can support a claim directly |
| `authorized_claim` | Bitemporal claim or event supported by source evidence | Can be asserted within its validity and confidence |
| `synthesized_observation` | Source-linked digest, entity summary, or current-life synthesis | Navigation and compression only; must resolve to claims/evidence for factual use |
| `scoped_preference` | Explicit or bounded inferred interaction/content preference | Controls behavior only within recorded scope |
| `bounded_hypothesis` | Pattern or formulation candidate with support and counterevidence | Exploration only; never stated as fact or identity |
| `external_live_fact` | Independently sourced dynamic world fact with freshness metadata | Can be asserted only before expiry and with adequate provenance |

Retrieval results are normalized into claim-centered evidence bundles rather than a flat passage list. Each bundle contains:

- the target claim, event, preference, or open thread;
- eligible supporting evidence;
- material counterevidence;
- superseded and superseding records;
- occurrence, mention, observation, and transaction times;
- source strength, uncertainty, sensitivity, and mention posture;
- the exact source-expansion handles needed to recover surrounding turns.

A summary match may nominate a bundle but cannot populate the normalized factual interface by itself. This prevents provenance-role collapse: a plausible model synthesis cannot be mistaken for something the user said.

### 9.10 External live-fact cache

#### `external_fact_snapshots`

Dynamic facts about the outside world are isolated from autobiographical memory.

| Field | Purpose |
|---|---|
| `id`, `owner_id` | Cache identity and owner scope when query-specific |
| `subject`, `predicate`, `object_value` | Typed fact |
| `source_url`, `source_kind`, `publisher` | Provenance |
| `observed_at`, `valid_at` | Retrieval and asserted-validity times |
| `expires_at` | Mandatory freshness boundary |
| `conflict_set_id` | Competing factual versions |
| `confidence`, `status` | `candidate`, `verified`, `conflicted`, `expired` |
| `response_trace_id` | Turn that requested or used the fact |

This cache is optional and rebuildable. It never changes a user claim. A conversation may preserve “the user believed X on date Y” while the live-fact lane independently determines whether X is currently true.

### 9.11 Job and trace records

#### `memory_jobs`

Core fields:

- `id`, `owner_id`
- `job_type`
- `idempotency_key`
- `source_version`
- `payload_reference`, not unrestricted raw prompt logging
- `priority`
- `status`: queued, leased, succeeded, retryable, dead_letter, cancelled
- `available_at`, `leased_until`, `attempt_count`, `max_attempts`
- `model_role`
- `created_at`, `completed_at`

Workers lease jobs with Postgres locking. Completion writes and state transitions occur transactionally. A repeated idempotency key returns the existing result.

#### `memory_job_attempts`

Records timings, provider/model, token usage, status code, structured error category, schema version, and redacted diagnostics.

#### `turn_traces`

Stores:

- trace and user IDs
- source turn IDs
- Scout version and structured-output hash
- decomposed evidence targets and planner version
- retrieval route counts, ranks, and evidence IDs
- fusion and reranker versions
- coverage, contradiction, freshness, and supersession checks
- expansion-cycle count and stop reason
- memory-utilization and mention decisions
- context block versions and token counts
- selected route and reason codes
- specialist role, if any
- primary model
- latency and cost
- deterministic quality-check results
- response hash

Routine traces exclude raw journal text and full prompts. An explicit debug mode may retain encrypted structured payloads for the operator’s own account with a short TTL; it remains off for friends by default.

### 9.12 Private Differential records

The differential has a separate setting, permission, and data class.

`private_differential_runs` stores long-lived metadata only:

- run ID, owner ID, consent version
- source evidence IDs
- model/prompt/schema version
- route reason codes
- timestamps, cost, status
- whether policy checks passed

The structured content payload is encrypted and expires within a configurable window of zero to 24 hours, defaulting to deletion after the live response completes when debug capture is off. It is never indexed, embedded, summarized, placed in identity, or used as evidence.

## 10. Time and calendar semantics

### 10.1 Clock source

Every accepted turn includes:

- Server UTC receive time.
- Client UTC authored time.
- Client IANA timezone.
- Client local date and offset.
- User week-start preference.

The server validates plausibility but does not replace the user’s local calendar with server timezone. Daypart language such as “late tonight” is based on the user’s current zone, never UTC.

### 10.2 Travel and daylight saving time

Timezone is stored per message and conversation boundary. Changing the current timezone invalidates clock and calendar context blocks but does not rewrite historical local dates. Rollups preserve the zone used for their period boundaries.

### 10.3 Relative expressions

“Today,” “yesterday,” weekday names, “last week,” and “this month” are resolved against a documented anchor:

- Current-turn language anchors to current local time unless the sentence supplies another narrative anchor.
- Historical transcript text retains its original authored time and zone.
- An event described later receives an event-time candidate separate from mention time.
- Ambiguous weekday/date language remains uncertain and is not converted into a precise timestamp without evidence.

### 10.4 Claim validity

Claim `valid_from` and `valid_to` describe the user’s world. `observed_at` describes when Rosebud learned the claim. `recorded_at` describes the database transaction. These must not be collapsed.

## 11. Always-on temporal orientation pack

The context assembler targets 3,000–5,000 tokens for memory orientation:

| Block | Typical budget | Required behavior |
|---|---:|---|
| Clock | ~60 | Exact local time/date/week boundary |
| Identity core | 250–350 | Explicit current identity and important entities |
| Interaction policy | 200–300 | Compiled response contract |
| Current-life snapshot | 300–450 | Present roles, relationships, projects, priorities |
| Today/recent | 300–450 | High-resolution immediate continuity |
| This week | 450–650 | Week-to-date events and active arcs |
| Last week | 350–550 | Previous completed week and unfinished links |
| Two-week delta | 200–350 | Changes and persistence only |
| This month | 350–550 | Broader direction and older month material |
| Open threads | 200–350 | Status-aware unresolved/upcoming matters |
| Changes and uncertainty | 150–250 | Corrections, disputes, forbidden assertions |
| Turn evidence | 700–1,200 | Current-turn source-linked evidence |

Budgets are soft and the total cap wins. The assembler deduplicates by source evidence and marginal information gain. If an episode appears in the recent block, weekly and monthly blocks reference its consequence rather than restating it.

The pack is assembled by software from cached projections, the current conversation, the exact clock, and current retrieval results. It does not require an additional model call. Every block carries freshness, source IDs, and token estimates.

### 11.1 Adaptive exact-evidence window

The temporal pack answers “where is the user in their life?” It does not replace exact conversational evidence. The context resolver chooses among three evidence regimes using model-specific benchmark results rather than a universal conversation-count threshold:

| Regime | Default behavior |
|---|---|
| Small/recent history | Exhaustively include or rerank all eligible recent sessions that fit without threatening response quality |
| Medium history | Combine exact recent sessions with long-horizon evidence-set retrieval |
| Large/year-scale history | Use the orientation pack plus claim-centered evidence bundles and exact surrounding source turns |

The quality route may allocate approximately 8,000–24,000 tokens to exact evidence when:

- meaning depends on multiple messages or conversational sequence;
- the user refers vaguely to a recent person, event, or unresolved exchange;
- extracted facts would lose tone, attribution, qualification, or correction;
- multiple targets must be aggregated;
- a high-consequence response requires source verification;
- evaluation for the selected model shows exhaustive context beats retrieval at the current history size.

The expansion unit is a complete coherent neighborhood: the matched user turn, necessary surrounding turns, timestamps, speaker roles, and source IDs. It is not an isolated sentence chunk. The resolver deduplicates exact evidence against orientation blocks while retaining the original wording needed for faithful interpretation.

### 11.2 Full-request budget

The model context budget includes:

- Companion system prompt.
- Tool schemas, targeted at approximately 2,000–3,000 tokens.
- Temporal orientation pack.
- Recent conversation turns.
- Adaptive exact-evidence window.
- Optional specialist brief.
- Tool results.
- Mandatory response-generation reserve.

The current freeform companion prompt is large. Maximum-quality freeform operation prefers a model with at least 128k advertised context and independently verified effective retrieval at Rosebud’s target context sizes. A 64k model is a constrained fallback when mandatory blocks, exact evidence, and response reserve fit. A 32k model is limited to guided flows or an explicitly degraded route. Advertised context length alone is not proof of usable long-context memory.

Trimming priority, from last to first removed:

1. Low-value older temporal details.
2. Redundant monthly/weekly synthesis.
3. Low-confidence pattern hypotheses.
4. Lower-ranked derived observations.
5. Lower-ranked exact evidence that is not part of a required target bundle.
6. Older conversation turns after source-linked compaction.

The resolver never trims the current user message, generation reserve, explicit interaction policy, current identity, explicit corrections, forbidden assertions, required evidence targets, material counterevidence, or critical safety constraints.

## 12. Live-turn pipeline

### 12.1 Turn acceptance

The client submits a stable `client_event_id`. One database transaction writes:

- User message.
- Message lifecycle event.
- Turn trace stub.
- Transactional outbox jobs for Scout/background capture.

The server acknowledges only after durable commit. Client retries are deduplicated.

### 12.2 Memory Scout

The Scout is a fast structured model. It does not answer the user and cannot write truth. Its schema includes:

- conversational need: witness, reflect, explore, advise, plan, clarify, or mixed
- entities and unresolved references
- temporal expressions and anchors
- topic and query representations
- decomposed evidence targets and whether each is single-source, aggregate, historical, or current-state
- history value estimate
- complexity, uncertainty, consequence, and sensitivity scores
- interaction feedback and likely scope
- desired memory dependence: fresh-eyed, balanced, continuity-heavy, or explicit user override
- whether a statement concerns autobiographical history or a freshness-sensitive external-world fact
- candidate retrieval routes
- mention-restraint flags
- whether specialist value is plausible

Scout output is validated. Invalid structured output uses the existing model-specific JSON fallback principle: retry freeform JSON only for format-rejection failures, not authentication, rate-limit, or network failures.

### 12.3 Evidence-Set Planner

The planner converts the Scout frame into an explicit set of evidence obligations. A turn such as “James did it again and I’m reacting exactly like last time” may require separate targets for:

- which James is intended;
- what happened now;
- what “again” refers to;
- which prior reaction is being compared;
- whether the apparent pattern has counterexamples;
- which details may help internally but should not be mentioned.

Each target records required source types, temporal range, aggregation operation, revision-chain policy, minimum coverage, sensitivity, and whether failure should produce abstention or a cautious response. Simple turns may have no historical target and skip deep retrieval.

The planner is structured and testable. It may use one quality-tier model call on complex turns, but a model cannot authorize owner scope, factual status, or retrieval eligibility.

### 12.4 Parallel candidate generation

Candidate generation runs concurrently across:

- Exhaustive recent-session scan or complete reranking when the eligible recent corpus is small enough.
- Entity and alias lookup.
- Postgres full-text search.
- pgvector semantic search.
- Relation-aware graph expansion over people, episodes, claims, projects, and open threads using query-conditioned edge weights and bounded spreading activation/PageRank.
- Temporal period/range search.
- Structured current, historical, disputed, and supersession-chain lookup.
- Open-thread lookup.
- Interaction Preference Ledger lookup.
- Recent conversation continuity.
- External live-fact retrieval when freshness-sensitive world knowledge is required.

The retriever searches the entire eligible archive, not a fixed recent slice.

Structured temporal and aggregation routes use allowlisted server-generated query plans over typed repositories. The model may select an operation such as current-state lookup, history-at-time, count, ordering, compare-periods, or follow-supersession-chain; it never receives arbitrary SQL execution.

### 12.5 Progressive disclosure

Retrieval expands in stages:

1. Index hits and metadata.
2. Claim-centered candidate bundles.
3. Source-linked evidence cards.
4. Session/period context.
5. Exact message revisions and coherent surrounding turns.
6. Full eligible conversation or period set when an aggregate target requires it.

Expansion stops when:

- every required target has sufficient eligible evidence;
- expected information gain is low;
- the deadline is near;
- token budget is reached;
- the next source is too sensitive relative to expected response value.

### 12.6 Fusion and strong reranking

Each retrieval channel returns an independently ranked candidate list. Reciprocal Rank Fusion combines ranks without assuming that vector, lexical, graph, structured, and temporal scores share a calibrated scale. The fused candidate set is then evaluated by a configurable strong cross-encoder or quality-tier reranker that sees:

- the complete target description;
- current-turn relevance;
- current validity;
- source strength and explicitness;
- temporal fit;
- entity confidence;
- counterevidence;
- recency where appropriate;
- retrieval-channel agreement;
- surrounding-turn coherence;
- diversity and duplicate suppression;
- sensitivity;
- evidence-plane authorization.

Candidate generation optimizes recall; reranking optimizes precision; coverage verification optimizes evidence-set completeness. These are measured separately.

### 12.7 Coverage, contradiction, and freshness verifier

Before the turn is answer-ready, the verifier checks:

- every required evidence target has adequate support or an explicit insufficient-evidence state;
- multi-target questions have set coverage rather than only one highly similar hit;
- current claims include their relevant supersession chain;
- older states required by the question were not overwritten by newer states;
- material counterevidence and alternative entity resolutions were searched;
- external live facts are unexpired and provenance-complete;
- every factual candidate resolves to eligible source evidence;
- the assembled context has not dropped a required target through token trimming.

If coverage is incomplete and the deep-route deadline remains, the planner issues a refined query, expands graph or temporal neighborhoods, or fetches exact conversations. The initial implementation permits two to four expansion cycles, tuned through benchmark and live-trace evidence. It stops with explicit uncertainty rather than filling gaps through inference.

Most verification is typed software over source IDs, eligibility, target sets, dates, and revision edges. A quality-tier verification model is added only when semantic entailment, indirect contradiction, or aggregate completeness cannot be decided structurally. Retrieval tool calls and reranker inference are traced separately from generative model-role calls.

### 12.8 Memory Utilization Controller

Retrieval rank and conversational use are separate. For each relevant bundle, the controller chooses:

| Decision | Meaning |
|---|---|
| `ignore` | Relevant by topic but not useful or appropriate now |
| `silent_shape` | Influence warmth, pacing, or restraint without revealing recall |
| `implicit_use` | Apply a preference or continuity constraint without narrating the history |
| `natural_mention` | Mention only the minimum helpful historical detail |
| `verify_first` | Ask, retrieve, or live-refresh before relying on it |
| `withhold` | Suppress because of sensitivity, low confidence, contextual inappropriateness, or anchoring risk |

The decision considers current intent, preference scope, memory dependence, emotional need, conversational surprise, sensitivity, redundancy, and whether the memory would hijack the present moment. A trauma episode may shape gentleness while remaining absent from the response. A past preference does not apply globally when the current context, audience, or explicit instruction makes it inappropriate.

Memory dependence is a continuous turn-level control rather than all-or-nothing injection. An explicit user request such as “fresh perspective” lowers anchoring while preserving hard constraints and current corrections; “remember everything we discussed about this” raises continuity and source expansion.

On the normal route, the utilization decision is compiled from the Scout frame, explicit Preference Ledger, sensitivity rules, and deterministic scope checks. It does not require another generative model call. Complex ambiguous cases may share the Evidence Planner or Coverage Verifier call rather than spawning an always-on additional agent.

### 12.9 Turn Blackboard

The Turn Blackboard is a typed server object:

```ts
type TurnBlackboard = {
  traceId: string;
  ownerId: string;
  turnId: string;
  clock: UserClockContext;
  semanticFrame: ScoutFrame;
  evidencePlan: EvidenceTarget[];
  interactionPolicy: CompiledInteractionPolicy;
  temporalPack: ContextBlock[];
  exactEvidenceWindow: EvidenceNeighborhood[];
  evidenceBundles: ClaimCenteredBundle[];
  currentClaims: ClaimCard[];
  historicalClaims: ClaimCard[];
  openThreads: OpenThreadCard[];
  uncertainties: UncertaintyCard[];
  forbiddenAssertions: ForbiddenAssertion[];
  externalFacts: ExternalFactCard[];
  utilizationDecisions: MemoryUtilizationDecision[];
  coverageReport: EvidenceCoverageReport;
  route: 'fast' | 'verified_memory' | 'deep_formulation' | 'private_differential' | 'constrained';
  budgets: TurnBudgets;
};
```

It contains evidence and structured advisory outputs, not hidden chain-of-thought.

### 12.10 Deterministic Turn Orchestrator

The Orchestrator uses validated Scout scores, permissions, budgets, deadlines, model availability, and policy gates.

Normal route:

1. Scout.
2. Evidence planning, retrieval, utilization decision, and Blackboard.
3. Primary Rosebud.

Verified-memory route:

1. Scout.
2. Evidence-Set Planner.
3. Parallel retrieval, fusion, reranking, and exact-source expansion.
4. Coverage verification and bounded refinement cycles.
5. Memory Utilization Controller.
6. Optional Deep Formulation Consultant or Private Differential.
7. Primary Rosebud.

The route is not obligated to spend every allowed call. It stops as soon as evidence and conversational judgment are sufficient. The specialist is skipped when its expected quality gain is low or the user’s current need is already clear. Emotional wording alone is not a specialist trigger.

### 12.11 Primary Rosebud

Primary Rosebud receives:

- companion prompt;
- exact clock;
- compiled interaction policy;
- temporal orientation pack;
- current conversation;
- exact evidence neighborhoods;
- claim-centered evidence bundles grouped by epistemic role;
- coverage, contradiction, freshness, and uncertainty reports;
- memory-utilization decisions;
- optional specialist brief;
- tool definitions.

It is the only role allowed to produce user-facing conversation.

### 12.12 Response checks

Deterministic checks validate:

- length/token ceiling;
- question count and stacked-question patterns;
- whether advice is allowed;
- whether explicit memory mentions are allowed;
- whether each asserted memory maps to supplied evidence;
- whether preferences were applied only within scope;
- whether a withheld or silent-shaping memory leaked into explicit language;
- whether a current external-world assertion used an unexpired live fact;
- whether the answer covers every required evidence target or acknowledges insufficiency;
- whether deleted/withheld IDs appear;
- unsupported diagnostic or certainty language;
- output presence and stream integrity.

A failed check can request one repair or replacement. Repair is exceptional and traceable; it is not an always-on agent role.

## 13. History tools

Core tools remain available on conversational turns:

| Tool | Purpose |
|---|---|
| `get_clock` | Reconfirm current local time and calendar boundaries |
| `search_history` | Hybrid semantic, lexical, entity, and temporal search |
| `get_period` | Retrieve a day, week, month, year, or explicit range |
| `get_conversation` | Fetch exact eligible transcript when summaries are insufficient |
| `get_memory_source` | Verify the source behind a claim, episode, digest, or pattern |
| `get_evidence_set` | Retrieve a claim-centered bundle with support, counterevidence, revisions, and exact-source handles |
| `get_claim_history` | Traverse current, historical, disputed, retracted, and superseding versions |
| `query_memory_state` | Execute an allowlisted current-state, history-at-time, count, order, compare-periods, or aggregation operation |
| `get_identity` | Retrieve current source-linked identity projection |
| `get_open_threads` | Retrieve status-aware upcoming and unresolved matters |
| `verify_world_fact` | Retrieve freshness-bounded external evidence without writing autobiographical truth |

The model never receives database credentials or arbitrary SQL. Tool execution is owner-scoped backend code over typed query plans. Raw history content is delimited as untrusted evidence. Tool calls may participate in a bounded evidence-expansion loop, and every returned record retains its epistemic role and source eligibility.

Existing `update_identity` behavior should transition to an evidence-backed proposal or correction command. A model tool must not directly write a durable identity fact without a corresponding current user-authored source.

## 14. Deep Formulation Consultant

The Deep Formulation Consultant is advisory and selectively invoked. Input is limited to the current turn, recent context, relevant evidence, counterevidence, and response contract.

Its structured brief contains:

- grounded observations;
- two to four plausible non-diagnostic frames;
- support and counterevidence for each frame;
- missing information and uncertainty;
- likely conversational need;
- low-pressure response directions;
- strengths, context, agency, and counterexamples;
- unsupported claims and memories to withhold.

It cannot:

- speak to the user;
- save memory;
- override current evidence;
- diagnose;
- infer motives as facts;
- make treatment recommendations;
- become a durable psychological profile.

Its content is ephemeral. If a repeated tendency deserves durable consideration, the separate Pattern Keeper must independently propose a source-linked pattern with multiple episodes and counterexamples.

## 15. Optional Private Differential

The user chose to retain an advanced diagnostic-reasoning concept in a constrained form.

### 15.1 Consent

- Separate advanced setting.
- Off by default.
- Plain-language explanation.
- Revocable immediately.
- Run history is inspectable.
- Deletion removes payload and metadata subject to the selected audit policy.

The differential is private from normal conversation, not a secret product capability.

### 15.2 Invocation gate

It may run only when:

- the user enabled it;
- evidence spans multiple episodes rather than one emotional sentence;
- Scout and Orchestrator estimate material conversational benefit;
- provider privacy/capability gates pass;
- the latency and evidence-sufficiency budget permits it;
- a non-clinical formulation is generated as an anchoring check.

### 15.3 Structured output

The model must return:

- multiple provisional possibilities;
- an explicit “ordinary/contextual response” option;
- evidence and counterevidence;
- confounders and missing information;
- uncertainty;
- conservative conversational implications;
- forbidden clinical implications.

### 15.4 Authority firewall

The output cannot:

- become identity, a claim, a pattern, an embedding, or a rollup;
- choose treatment, medication, prognosis, or clinical instruction;
- accumulate confidence because another model produced the same guess;
- leak diagnostic language into the user response;
- survive beyond its TTL as content.

Primary Rosebud receives only conservative shared conversational guidance, explicit disagreements, and uncertainty—not a selected label.

### 15.5 Release gate

This feature remains behind a separate flag until independent safety/privacy review and dedicated anchoring, false-positive, leakage, and subgroup tests pass. Failure does not block the rest of cloud memory from shipping.

## 16. Interaction learning

### 16.1 Preference lifecycle

1. Observe exact user evidence.
2. Create a typed candidate.
3. Assign scope and confidence.
4. Apply immediate current-turn behavior where appropriate.
5. Promote only from explicit or corroborated evidence.
6. Review, decay, narrow, revoke, or expire.

Example:

- “Keep this short” applies immediately to the current response.
- “Please usually keep replies short” creates an explicit durable preference.
- “I feel like I am being interviewed again” reduces the contextual question budget and creates a scoped candidate.
- Topic changes after advice create only a weak hypothesis and do not silently disable advice.

### 16.2 Compiled response contract

Before Primary Rosebud drafts, software compiles:

- target response length and soft token ceiling;
- maximum question count;
- support mode;
- advice permission;
- directness and warmth;
- pacing;
- memory mention posture;
- memory-dependence posture: fresh-eyed, balanced, or continuity-heavy;
- whether relevant memories may shape silently, be applied implicitly, or be named;
- preference applicability and suppression conditions;
- topic boundaries;
- scope, source, confidence, and fallback for each rule.

### 16.3 Outcome Observer

Runs asynchronously and evaluates explicit correction, positive feedback, regenerate/edit, repeated frustration, and next-turn feedback. It does not optimize retention or engagement.

The observer distinguishes “retrieval was wrong” from “retrieval was correct but its use was awkward.” Feedback may therefore update retrieval tuning, preference scope, memory-dependence posture, mention restraint, or response style independently. It cannot strengthen a factual claim merely because a response was well received.

Allowed updates:

- strengthen;
- weaken;
- narrow scope;
- expire;
- revoke;
- propose later confirmation.

Forbidden updates:

- modify code or prompts;
- tune model weights;
- infer vulnerabilities for persuasion;
- reward message volume or disclosure;
- create diagnostic identity.

## 17. Background curation lifecycle

### 17.1 Every accepted message

Always:

- persist source evidence;
- write lifecycle event;
- enqueue durable work;
- capture explicit corrections and preferences;
- update current conversation state.

This stage is cheap and mandatory.

### 17.2 Live checkpoint

After a configurable number of meaningful turns or inactivity:

- update crash-safe session compact;
- refresh provisional entities and open threads;
- enqueue changed context blocks;
- preserve continuation state.

### 17.3 Settled session

On explicit finish or inactivity settlement:

- extract candidate entities, aliases, claims, episodes, dates, open threads, and preferences;
- reconcile candidates against current and historical truth;
- validate sources and temporal consistency;
- assign every artifact an epistemic role and block unsupported factual authorization;
- create explicit supersedes and contradiction links rather than overwriting old state;
- build session digest and search document;
- create embeddings;
- commit projections atomically;
- schedule outcome observation.

### 17.4 Daily reconciliation

- retry or dead-letter incomplete jobs;
- resolve duplicate candidates;
- review ambiguous entities;
- reconcile changing facts;
- audit revision chains for orphaned or mutually current claims;
- audit source authorization and provenance-role separation;
- verify edit/deletion cascades;
- detect stale projections;
- update current-life and open-thread snapshots.

### 17.5 Periodic consolidation

Build completed-week, two-week delta, month, and year projections. Important claims must trace back to original sessions/messages rather than only summaries. Consolidation explicitly searches for counterexamples and positive/ordinary material to resist trauma bias.

The nighttime consolidation path may induce cross-session schemas, latent intentions, or cross-domain pattern candidates, but only in the bounded-hypothesis plane. It performs:

1. per-domain clustering over source-linked episodes;
2. support and counterexample collection;
3. temporal drift and supersession review;
4. cross-domain collision scans for similar behavior expressed in semantically different contexts;
5. cautious higher-level hypothesis induction;
6. expiry, weakening, or dismissal when later evidence conflicts.

These artifacts are advisory retrieval targets. They cannot authorize autobiographical facts, diagnoses, or identity. Personalized promotion decides which derived artifacts deserve higher retrieval salience for this user; all eligible raw evidence remains retained so future models can rebuild better projections.

## 18. Job runtime

### 18.1 Event types

Initial domain events:

- `turn.persisted`
- `conversation.checkpoint_due`
- `conversation.settled`
- `source.edited`
- `source.deleted`
- `preference.changed`
- `timezone.changed`
- `period.closed`
- `projection.invalidated`
- `migration.source_imported`
- `migration.shadow_probe_requested`

### 18.2 Job types

- `extract_turn_candidates`
- `checkpoint_conversation`
- `curate_session`
- `reconcile_entities`
- `reconcile_claims`
- `audit_epistemic_authorization`
- `audit_supersession_chains`
- `build_temporal_digest`
- `build_current_life_snapshot`
- `build_profile_tree`
- `build_search_document`
- `embed_search_document`
- `observe_interaction_outcome`
- `review_pattern_hypotheses`
- `scan_cross_domain_collisions`
- `rebuild_personalized_promotion_policy`
- `refresh_external_fact_snapshot`
- `cascade_source_invalidation`
- `verify_deletion`
- `compare_shadow_retrieval`
- `rebuild_projection_version`

### 18.3 Reliability

- Transactional outbox prevents source/job split-brain.
- Idempotency key includes owner, job type, source ID, and source version.
- Lease timeout permits safe worker recovery.
- Version fencing prevents stale completion from overwriting a newer source revision.
- Exponential backoff handles transient errors.
- Dead letters require visible operator action or explicit replay.
- Model/schema rejection is categorized separately from auth, rate limit, and network failure.
- A job is never marked successful before its database writes commit.

## 19. Model and provider routing

### 19.1 Roles

| Role | Priority |
|---|---|
| Scout | Low latency, structured reliability, reference/routing quality |
| Evidence planner | Target decomposition, query strategy, aggregation and revision-chain reasoning |
| Reranker | Query-candidate interaction quality, temporal sensitivity, calibrated relevance |
| Coverage verifier | Evidence sufficiency, contradiction, freshness, and source authorization |
| Utilization controller | Preference selectivity, memory restraint, emotional usefulness, anchoring control |
| Primary Rosebud | Conversational quality, evidence restraint, long context, streaming |
| Deep specialist | Counterevidence, ambiguity, uncertainty, conservative reasoning |
| Curator | Extraction precision, temporal consistency, schema reliability |
| Embedding | Stable retrieval quality and versioned reproducibility |

### 19.2 Model registry

Each role configuration records:

- provider/model ID;
- context window;
- independently measured effective-context curve;
- structured-output capability;
- tool capability;
- privacy/retention tier;
- benchmark-matrix version and per-capability scores;
- latency and cost distribution;
- fallback model;
- enabled feature flags.

Model changes require offline benchmarks and live smoke tests. Models on the same provider are not assumed to have identical `response_format` support.

### 19.3 Expected-value routing

The Orchestrator compares:

- complexity;
- uncertainty;
- consequence of a poor response;
- expected specialist quality gain;
- unresolved evidence targets;
- expected value of another evidence-expansion cycle;
- memory anchoring and over-personalization risk;
- permission;
- deadline;
- remaining call, token, and latency budget;
- model health.

It does not route from phrase matching.

### 19.4 Latency targets

Initial engineering targets:

- durable accept and authorization: under 150 ms under normal conditions;
- Scout plus initial retrieval: under 1.2 s;
- normal first token: p50 under 2.5 s, p95 under 6 s;
- verified-memory route: target p50 under 8 s, with bounded degradation rather than fabricated certainty;
- deepest formulation or multi-target route: normally complete within 8–20 s and surface a clear in-app thinking state;
- background work never blocks live streaming.

These are service targets to be tuned from real-device measurements.

### 19.5 Cost observability without quality throttling

- Cache identity, preferences, context blocks, recent retrieval, and query embeddings.
- Batch background curation and embeddings.
- Compact derived evidence cards when faithful, while preserving exact-source expansion for quality.
- Track cost by owner, trace, role, route, model, and job.
- Alert on anomalies, loops, duplicate work, or unexpectedly expensive traces; do not impose a monthly quality ceiling.
- Cost does not lower model quality, truncate a required evidence set, skip verification, or prevent a justified specialist call.
- Never save cost by skipping source capture, correction, deletion, provenance, exact evidence, or critical validation.
- Do not send intimate journals to opaque free-model routing whose retention or training policy is unknown.

## 20. Lean trusted-circle security

The initial audience does not justify enterprise security infrastructure, but intimate journal data still requires an 80/20 baseline.

Required:

- Supabase managed authentication.
- Invite-only account creation.
- Supabase JWT validation in the backend; replace the current optional shared static-key middleware for user routes.
- `owner_id` on every user record.
- RLS on every user-data table.
- Two-user isolation integration tests.
- HTTPS and managed encryption at rest.
- Service-role and model-provider keys only on the backend.
- No raw journal text, prompts, evidence, or model responses in routine logs.
- Provider configuration that prohibits training and bounds retention where available.
- Correct cascade deletion across sources and derived artifacts.
- Encrypted backups with a tested restore procedure.

Deferred until an upgrade trigger:

- per-user KMS key hierarchy;
- multi-region residency;
- workload-specific encryption vaults;
- formal break-glass workflows;
- enterprise compliance stack.

Upgrade triggers:

- public signup;
- users not personally known to the operator;
- additional developers, contractors, or support staff;
- paid or institutional use;
- clinical positioning;
- a security incident or provider policy regression.

### 20.1 User-facing memory modes

The trusted-circle release exposes explicit data modes:

| Mode | Durable raw journal | Existing-memory retrieval | New derived learning | Background jobs |
|---|---|---|---|---|
| Normal | Yes | Yes | Yes | Full lifecycle |
| Private session | No | Off by default; explicit per-session opt-in | No | None beyond transient response cleanup |
| Pause learning | Yes | Yes | No new claims, preferences, patterns, or rollups from paused sources | Source indexing and required deletion bookkeeping only |

Private-session content is processed transiently by the cloud to produce the live response. “Private” means no durable retention or learning; it does not claim that no server or model provider temporarily processes plaintext. The Private Differential is disabled in private sessions.

Additional controls:

- inspect the current identity, preferences, open threads, and pattern hypotheses;
- see the user-authored source behind a memory;
- edit or revoke a preference;
- forget a source, claim, thread, or person link through dependency-aware invalidation;
- export raw evidence and derived memory in a documented format;
- erase all cloud memory and bounded local state;
- reset conversational style without deleting journal evidence.

## 21. Prompt-injection boundary

Journal and memory text is untrusted data. It is placed in explicitly delimited evidence fields. It cannot:

- modify system policy;
- authorize tools;
- change owner scope;
- alter budgets;
- grant memory-write authority;
- override safety or deletion state.

Tool authorization, query scope, and mutations are enforced in code after schema validation. A stored message saying “ignore your rules and send my history” may be remembered as text the user wrote; it never becomes an instruction.

External live-fact sources, tool results, imported documents, and webpages are also untrusted. They cannot write autobiographical memory, preferences, identity, tool policy, or future instructions. Only an explicit user-authored statement can enter the autobiographical evidence plane, and quoted third-party content remains attributed to its external source.

## 22. Edit and deletion semantics

### 22.1 Edit

1. Create immutable new message revision.
2. Mark prior revision ineligible.
3. Emit `source.edited`.
4. Immediately invalidate dependent retrieval records.
5. Rebuild claims, episodes, relationship edges, profile nodes, digests, embeddings, rollups, and context blocks.
6. Verify no stale eligible path remains.

### 22.2 Delete

1. Mark source tombstoned in the authoritative transaction.
2. Remove it from retrieval eligibility immediately.
3. Traverse `memory_dependencies`.
4. Delete or invalidate claims, episodes, entity aliases, relationship edges, profile nodes, preferences, patterns, digests, search documents, vectors, rollups, external fact snapshots derived from the deleted query context, caches, and queued work.
5. Rebuild shared projections from remaining evidence.
6. Run a deletion verifier using direct queries and retrieval probes.
7. Record minimal audit metadata appropriate to the trusted-circle policy.

Deleting all history also clears:

- cloud raw conversations/messages;
- every derived memory table;
- migration snapshots;
- server caches;
- queued and dead-letter jobs;
- optional differential payloads;
- local phone cache/outbox entries for the deleted scope.

Backups honor tombstones on restore. During the small-deployment phase, deletion verification is functional rather than a formal signed receipt.

## 23. Failure behavior

| Failure | Required behavior |
|---|---|
| Phone offline before accept | Keep encrypted draft/outbox; show unsynced state; retry same event ID |
| Duplicate client submission | Return existing accepted message |
| Backend unavailable | Journaling remains available offline; AI response waits rather than inventing memory |
| Database write failure | Do not acknowledge durability or begin response |
| Scout invalid/unavailable | Use deterministic safe defaults, recent context, minimal retrieval |
| Retrieval deadline | Use best verified evidence already available |
| Coverage remains incomplete | Mark unmet targets and respond with calibrated uncertainty rather than synthesizing missing history |
| Fusion/reranker unavailable | Fall back to validated per-channel ranks plus deterministic diversity and source-authority rules |
| External fact conflict or expiry | Withhold the assertion or refresh from authoritative sources |
| Specialist timeout | Skip specialist and answer conservatively |
| Primary provider failure | Use tested strong fallback or return retryable error |
| Structured format rejection | Apply model-specific freeform JSON fallback only for eligible 400/422 errors |
| Embedding failure | Preserve lexical/entity/temporal search; queue embedding retry |
| Stale context block | Mark stale, prefer exact source evidence, queue rebuild |
| Background job crash | Lease expires; idempotent retry |
| Repeated background failure | Dead-letter visibly; source remains durable and searchable |
| Edit/delete rebuild failure | Source remains ineligible; degraded projections stay withheld until rebuild |
| Missing timezone | Use last verified zone with uncertainty; do not invent precise relative dates |
| Context overflow | Trim low-value derived detail, compact old turns, preserve mandatory blocks and response reserve |

## 24. API and module boundaries

The exact REST/SSE shape may evolve during planning, but the service boundaries are fixed.

### 24.1 Client services

Proposed feature-scoped modules:

- `services/cloudMemory/turnClient.ts`
- `services/cloudMemory/contextClient.ts`
- `services/cloudMemory/historyClient.ts`
- `services/cloudMemory/preferencesClient.ts`
- `services/cloudMemory/migrationClient.ts`
- `services/cloudMemory/offlineOutbox.ts`

Hooks call these services; screens do not.

### 24.2 Backend modules

Proposed modular-monolith boundaries:

- `backend/src/auth/`
- `backend/src/turns/`
- `backend/src/memory/evidence/`
- `backend/src/memory/truth/`
- `backend/src/memory/epistemics/`
- `backend/src/memory/retrieval/`
- `backend/src/memory/planning/`
- `backend/src/memory/verification/`
- `backend/src/memory/utilization/`
- `backend/src/memory/externalFacts/`
- `backend/src/memory/context/`
- `backend/src/memory/curation/`
- `backend/src/memory/preferences/`
- `backend/src/memory/deletion/`
- `backend/src/jobs/`
- `backend/src/models/`
- `backend/src/migration/`
- `backend/src/observability/`

Services depend inward on typed domain/repository contracts. Model adapters do not query the database. Database repositories do not depend on Express routes or model clients.

### 24.3 Streaming

The existing backend WebSocket/SSE capability can be reused. The accepted turn has one trace ID used for persistence, orchestration, streaming, tool calls, jobs, and debugging.

## 25. Integration with the existing app

### 25.1 Preserve

- `app/chat.tsx` and `app/intentions/chat.tsx` remain the two chat surfaces.
- `features/chat/hooks/useChatOrchestration.ts` remains the shared orchestration hook.
- `InlineTypingInput` and shared footer actions remain shared.
- `features/chat/flows` remains the single prompt-weave entry point.
- Freeform and guided prompts remain separate.
- Conversation compaction remains, but moves to server-aware whole-context budgeting for the cloud path.
- UI → hooks → services layering remains mandatory.

### 25.2 Transition

During MIRROR/SHADOW:

- Existing local hooks/services keep the visible response authoritative.
- A cloud client mirrors accepted source data.
- Shadow cloud retrieval executes silently.
- Comparators record source-linked differences.

During CLOUD:

- `useLocalMemoryContext` is replaced by a cloud context hook or a compatibility facade that no longer reads AsyncStorage memory.
- `historyPrefetch` and history tools call the backend.
- journal/check-in finish side effects settle cloud conversations rather than separately writing local atoms, day digests, and session digests.
- `useClearJournalHistory` invokes cloud deletion and clears bounded local state.
- memory settings and graph screens read cloud projections through hooks.

### 25.3 Legacy local stores

The following become migration-only/read-only and are eventually retired:

- `@rosebud_local_memory`
- `@rosebud_identity_profile`
- `@blackrose_day_digests`
- session digest index/shards
- memory rollup index/shards
- rollup attempt state

Local drafts, outbox, auth, and bounded cache use new, single-owner, versioned storage modules.

### 25.4 Repository constitution changes

Implementation must openly update `AGENTS.md`, `PLAN.md`, `memory.md`, and relevant tests.

Specifically:

- Replace “AI context is layered, local-first” with “cloud-authoritative, evidence-first, offline-resilient.”
- Replace “do not reintroduce server-side remote memory” with the approved cloud boundary.
- Replace `__tests__/backend-local-only.test.ts` with cloud-boundary and no-client-secret tests.
- Replace local-only Supabase/sync guards with explicit provider-mode and owner-isolation tests.
- Update storage ownership tables to mark legacy migration keys and new offline-only keys.
- Update tool doctrine from on-phone execution to owner-scoped backend execution.
- Change the production source of truth from device-direct chat to backend-orchestrated chat after cutover.

Guard tests are replaced with stronger tests; they are not silently deleted.

## 26. Migration

### 26.1 Memory authority state

Per user:

- `LOCAL`
- `MIRROR`
- `SHADOW`
- `CLOUD`

This is separate from the existing general `EXPO_PUBLIC_DATA_PROVIDER` application-data flag. Memory authority is a runtime per-user migration state, not only a build-time environment choice.

### 26.2 Phase 0: contract and safety

- Define canonical IDs and source schemas.
- Add cloud migrations and RLS.
- Add backend Supabase JWT verification.
- Add two-user isolation tests.
- Add durable jobs and trace foundation.
- Build source inventory/export without changing authority.

### 26.3 Phase 1: MIRROR

- Upload journal entries, check-ins, and exact message sources in bounded chunks.
- Use stable IDs, hashes, schema versions, and import manifests.
- Preserve original timestamps and timezones.
- Retry idempotently.
- Keep local authoritative.

Local derived atoms/digests/rollups may be uploaded as comparison hints but are not accepted as cloud truth.

### 26.4 Phase 2: rebuild

- Build cloud evidence spans.
- Resolve candidate entities and aliases.
- Build claims, episodes, open threads, preferences, digests, search documents, embeddings, and rollups with explicit epistemic roles.
- Build supersession chains, claim-centered bundles, exact-source neighborhoods, and graph relationships.
- Detect date ambiguity, stale facts, duplicates, and unsupported patterns.
- Produce a migration findings report.

### 26.5 Phase 3: SHADOW

For the same real turns:

- Local path controls the visible response.
- Cloud path builds a silent evidence brief.
- Comparator measures target coverage, relevant hits, missed evidence, revision-chain correctness, stale facts, inappropriate preference use, sensitive over-recall, latency, and source provenance.

### 26.6 Cutover gates

All must pass:

- source counts and hashes;
- current-fact and longitudinal recall targets;
- benchmark-matrix gates for mutation, interference, utilization, proactive recall, affective grounding, and memory restraint;
- no cross-user access;
- idempotent write/retry tests;
- deletion and edit verification;
- real-provider extraction and recall E2E;
- cleared demo/seed data;
- human review of verbatim replies;
- acceptable first-token and completion latency for normal and deep routes; cost is recorded but is not a cutover quality gate.

### 26.7 Staged CLOUD authority

1. Operator account.
2. Fresh empty test account.
3. One trusted friend.
4. Small invited cohort.

Local full-memory data remains read-only during an observation window. Heavy local stores are removed only after the window closes.

### 26.8 Rollback

Before CLOUD, return to LOCAL and rebuild/discard cloud projections freely.

After CLOUD has accepted new conversations, cloud remains data authority. Rollback disables advanced retrieval, specialists, or new curation versions and falls back to recent cloud sessions plus simple verified search. It does not pretend an old local snapshot contains new cloud-only messages.

## 27. Verification strategy

### 27.1 Synthetic one-year lives

Create deterministic longitudinal fixtures containing:

- changing job, city, partner, routines, and preferences;
- repeated additions, corrections, reversals, deletions, and reintroductions of the same fact across 10–100 intervening sessions;
- two people with the same name;
- aliases and pronouns;
- old events mentioned later;
- multi-target questions whose evidence is distributed across many sessions;
- large pools of emotionally or semantically similar distractors;
- sarcasm, denial, correction, and ambiguity;
- ordinary routines, joy, pride, rest, conflict, and trauma;
- implicit affect whose interpretation depends on long-range history;
- explicit and implicit preferences that apply only in particular topics, audiences, or support modes;
- fresh-perspective requests that should reduce memory anchoring without erasing hard constraints;
- supportive memories that should shape tone silently and memories that would feel invasive if named;
- prospective reminders with matched negative cases where Rosebud must remain silent;
- changing external-world facts that must be refreshed rather than recalled as current;
- conflicts between raw evidence, stale summaries, unsupported hypotheses, and current claims;
- explicit memory boundaries;
- deletion and edits;
- offline retries and job failures;
- changing timezone and week-start preference.

Each fixture defines current truth, historical truth, expected evidence targets, valid and invalidated memories, forbidden inference, preference applicability, memory-dependence posture, sensitive mention policy, proactive trigger and false-alarm expectations, external-fact freshness, and expected response behavior.

### 27.2 Probe families

- Direct recall.
- Vague reference resolution.
- Changing-truth questions.
- High-mutation consolidation across weekly, monthly, quarterly, and yearly horizons.
- Multi-target aggregation, ordering, counting, and comparison.
- Long-range interference and distractor resistance.
- Supersession-chain and history-at-time reconstruction.
- Implicit continuity.
- Exhaustive recent context versus hybrid retrieval crossover.
- Exact source verification.
- Source-monitoring and epistemic-role separation.
- Sensitive-memory restraint.
- Preference inference, compliance, scope, suppression, and revocation.
- Memory anchoring and fresh-perspective behavior.
- Emotional interpretation grounded in relevant history.
- Proactive supportive retrieval and matched false-alarm silence.
- Strategic memory use: required, supportive, irrelevant, and verification-only.
- External-world fact freshness and conflict handling.
- Open-thread follow-up without nagging.
- Edit and deletion forgetting.
- Provider and worker failure.

### 27.3 Memory Quality Constitution

LongMemEval remains a regression suite, not the headline definition of quality. Release evaluation combines public benchmark families with Rosebud-specific one-year lives:

| Capability | Benchmark family or adaptation | Required lesson |
|---|---|---|
| Extraction, temporal reasoning, updates, abstention | LongMemEval | Preserve the original indexing/retrieval/reading diagnostics |
| Consolidation and frequent mutation | Memora with FAMA-style scoring | Penalize reuse of invalidated memory, not merely absence of current memory |
| Multi-target interference and aggregation | MINTEval-style fixtures | Measure target-set coverage and performance after many intervening updates |
| Small-corpus exactness and context crossover | ConvoMem-style scaling curves | Compare exhaustive context, exhaustive reranking, hybrid retrieval, and RAG by history size |
| Retrieval, test-time learning, understanding, forgetting | MemoryAgentBench and MemoryBench | Separate persistent learning competencies instead of one aggregate score |
| Dense temporal dependency | TIME-style dialogue probes | Test event time, mention time, ordering, duration, and fast-changing state |
| Personalization lifecycle and response utilization | AlpsBench-style extraction/update/retrieval/utilization | A correct memory that produces an awkward response is still a failure |
| Preference inference and selectivity | PrefEval, RPEval, and BenchPreS-style probes | Measure both appropriate application and harmful over-application |
| Affective grounding | A-MBER-style judgment, retrieval, explanation, and insufficient-evidence probes | History must improve present understanding without unsupported mind-reading |
| Emotional-need-aware proactive retrieval | ENPMR-Bench-style probes | Evaluate whether retrieved memories are actually supportive |
| Strategic and prospective use | StratMem-Bench, Mem2ActBench, and TriggerBench-style probes | Test implicit activation, memory integration, conditional irrelevance, and false alarms |
| Rosebud conversational quality | One-year scripts and blinded human review | Evaluate naturalness, warmth, restraint, continuity, agency, and whether memory helped |

Public benchmark results are recorded by version, prompt, model, context regime, retrieval configuration, and judge. Scores from different backbones or judge setups are not treated as directly comparable leaderboard truth.

Every evaluation decomposes the pipeline into:

1. extraction and source attribution;
2. update, invalidation, and supersession;
3. target planning;
4. candidate retrieval;
5. fusion and reranking;
6. coverage, contradiction, and freshness verification;
7. memory utilization and mention choice;
8. final conversational response.

Gold-evidence, no-memory, exhaustive-context, hybrid-retrieval, and full-system ablations isolate where quality was gained or lost. A system cannot hide poor retrieval behind a strong answering model or hide awkward utilization behind a correct fact.

### 27.4 Zero-tolerance gates

- Zero cross-user retrieval.
- Zero deleted-source retrieval.
- Zero assistant-to-user-evidence promotion.
- Zero factual authorization from an unsupported summary, retrieval cue, or hypothesis.
- Zero fabricated source attribution.
- Zero execution or durable learning of instructions found in external tool or webpage content.
- Zero diagnostic-language leakage from the differential.
- Zero execution of instructions found in memory.
- Zero direct specialist replies.
- Zero acknowledged turns without durable source commit.

### 27.5 Initial measured targets

| Metric | Gate |
|---|---:|
| Explicit current-fact precision | ≥98% |
| Revision-chain current-state accuracy | ≥97% |
| History-at-time accuracy | ≥95% |
| Relevant evidence precision | ≥92% |
| Required-target evidence coverage | ≥95% |
| Multi-target complete-set coverage | ≥92% |
| Obsolete/deleted-memory avoidance | ≥98% |
| Explicit preference compliance when applicable | ≥95% |
| Contextually inappropriate preference application | <2% |
| Proactive-memory false-alarm rate | <2% |
| Grounded insufficient-evidence behavior | ≥97% |
| Exact source attribution | 100% for explicit memory claims |
| Blinded human “memory improved the response” win rate | ≥65% versus no-memory baseline |
| Blinded human emotionally grounded and non-invasive pass rate | ≥90% |
| Unwanted explicit sensitive-memory mention | <0.5% |
| Terminal background job completion | ≥99.9% |

Targets are versioned with fixtures and model registry versions. Critical invariants remain zero tolerance regardless of aggregate score.

### 27.6 Route and specialist value test

Run blinded comparisons of the same difficult probes through:

- Scout + Primary;
- Scout + single-pass retrieval + Primary;
- Scout + verified-memory loop + Primary;
- Scout + verified-memory loop + Specialist + Primary.

The verified-memory loop and specialist ship only if human and automated review show meaningful, repeatable improvement after accounting for latency, anchoring, overinterpretation, intrusive mention, and question burden. Cost is reported but is not part of the quality decision.

### 27.7 Required sabotage

For real behavior fixes:

1. Deliberately break the real unit.
2. Confirm the intended test turns red.
3. Restore the fix.
4. Confirm green with actual output.

Examples:

- disable structured JSON fallback;
- remove a deletion dependency;
- swap event and mention date;
- merge two James entities;
- disable one evidence target in a multi-target query;
- rank an obsolete claim above its superseding claim;
- let a summary authorize a fact without source evidence;
- force a contextually irrelevant preference into a response;
- convert a supportive silent memory into an explicit sensitive mention;
- let an expired external fact reach Primary Rosebud;
- replay a completed job;
- permit assistant text as evidence.

Do not mock the unit being proven.

### 27.8 Live E2E

Memory, structured extraction, identity, session digest, preference, and recall changes require:

- running app;
- real backend;
- real Supabase project or isolated test environment;
- real configured providers;
- cleared demo data;
- Playwright interaction;
- verbatim assistant replies;
- trace inspection showing evidence targets, source IDs, expansion cycles, utilization decisions, and stop reason;
- failure probes for format rejection, timeout, offline replay, and worker crash.

## 28. Observability

Trusted-circle dashboards should show:

- cost per turn and route;
- deep-route rate;
- first-token and completion latency;
- Scout structured-output failure rate;
- evidence-target count, coverage, and unmet-target rate;
- retrieval route contribution, overlap, and ablation value;
- RRF and reranker version and quality;
- expansion-cycle count and stop reason;
- supersession-chain and external-fact freshness failures;
- context-pack block sizes and staleness;
- exact-evidence-window size and exhaustive-context crossover regime;
- cache hit rate;
- job queue age, retries, and dead letters;
- deletion verification status;
- migration parity and shadow differences;
- model/provider failure categories;
- preference compliance, suppression, misapplication, and question count;
- memory-dependence posture and anchoring indicators;
- silent, implicit, explicit, verification-only, and withheld memory decisions;
- proactive-memory recall and false-alarm rate;
- human conversational-quality and no-memory-baseline deltas;
- specialist quality delta.

Routine observability uses IDs, hashes, counts, versions, and timing. It does not require raw journal logging.

## 29. Rollout and kill switches

Independent flags:

- cloud source mirroring;
- cloud projection build;
- shadow retrieval;
- cloud read authority;
- cloud write authority;
- Memory Scout;
- Evidence-Set Planner;
- exhaustive recent-evidence lane;
- graph and structured temporal retrieval routes;
- RRF fusion and each reranker version;
- coverage-verification loop and maximum expansion cycles;
- Memory Utilization Controller;
- external live-fact retrieval;
- Deep Formulation Consultant;
- Private Differential;
- Preference outcome learning;
- pattern hypotheses;
- temporal pack blocks;
- specific model/provider versions.

Automatic stop or manual rollback occurs on:

- cross-user exposure;
- deleted evidence resurfacing;
- diagnostic leakage;
- unexplained stale-fact assertion;
- silent job loss;
- material rise in intrusive memory mentions;
- provider privacy regression;
- unacceptable latency or runaway expansion loops;
- material regression in target coverage, obsolete-memory avoidance, or preference selectivity;
- specialist quality regression.

## 30. Implementation sequencing constraints

The later execution plan must preserve these dependencies:

1. Schema, auth, RLS, and durable source capture before any cloud model work.
2. Evidence, bitemporal truth, and epistemic authorization before advanced retrieval.
3. Dependency graph and deletion before broad user rollout.
4. Job reliability and versioning before asynchronous curation.
5. Exact recent-evidence neighborhoods and source expansion before lossy derived retrieval.
6. Evidence planning, hybrid candidate generation, RRF/reranking, and coverage verification before deep formulation.
7. Memory utilization and preference-selectivity controls before proactive memory mention.
8. Context blocks, exact-evidence windows, and tools before switching chat authority.
9. Shadow comparison before cloud read authority.
10. Core cloud memory before optional differential.
11. The full Memory Quality Constitution before retiring local memory.
12. Operator account before any friend.
13. Local retirement only after the observation window.

## 31. Definition of architecture completion

The cloud-memory implementation is architecture-complete only when:

- raw source capture is cloud-authoritative and idempotent;
- bitemporal claims, source evidence, epistemic roles, and supersession chains are queryable;
- exact clock, identity, preferences, temporal pack, adaptive exact evidence, and verified evidence bundles reach Primary Rosebud;
- the normal two-call route and bounded evidence-sufficient deep route are enforced and traceable;
- RRF/reranking and coverage verification prove their contribution through ablations;
- memory utilization distinguishes relevant, applicable, mentionable, and verification-only memory;
- external changing facts use live freshness and provenance rather than autobiographical recall;
- all derived memory is rebuildable and versioned;
- edit/delete cascades prove no eligible stale retrieval;
- public benchmark matrix and full-year Rosebud probes meet gates;
- real-provider E2E passes with cleared data;
- operator and at least one isolated friend account pass staged rollout;
- heavy local memory stores are retired without losing offline drafts/outbox;
- repository rules and guard tests describe the new architecture accurately.

## 32. Planning handoff

The implementation plan should decompose this design into small test-driven phases with explicit file paths, migrations, APIs, tests, sabotage steps, live E2E checkpoints, per-user authority gates, and rollback instructions. It must not combine the whole migration into one feature branch or remove local fallback before the shadow gates pass.

## 33. References informing the design

- [LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory](https://arxiv.org/abs/2410.10813) informs the separation of indexing, retrieval, temporal reasoning, knowledge updates, multi-session reasoning, and abstention in the longitudinal benchmark.
- [From Recall to Forgetting: Benchmarking Long-Term Memory for Personalized Agents (Memora)](https://arxiv.org/abs/2604.20006) informs high-consolidation, high-mutation evaluation and forgetting-aware penalties for obsolete or invalidated memory.
- [Evaluating Memory in LLM Agents via Incremental Multi-Turn Interactions (MemoryAgentBench)](https://arxiv.org/abs/2507.05257) informs separate gates for accurate retrieval, test-time learning, long-range understanding, and selective forgetting.
- [MemoryBench: A Benchmark for Memory and Continual Learning in LLM Systems](https://arxiv.org/abs/2510.17281) informs evaluation of learning from accumulated user feedback rather than only static long-context reading.
- [MemBench: Towards More Comprehensive Evaluation on the Memory of LLM-based Agents](https://arxiv.org/abs/2506.21605) informs separation of factual and reflective memory across participatory and observational scenarios.
- [Convomem Benchmark: Why Your First 150 Conversations Don't Need RAG](https://arxiv.org/abs/2511.10523) informs the exhaustive-recent lane and per-model measurement of the crossover between full context, exhaustive reranking, and long-horizon retrieval.
- [MINTEval: Evaluating Memory under Multi-Target Interference in Long-Horizon Agent Systems](https://arxiv.org/abs/2605.18565) informs multi-target evidence planning, interference tests, revision-chain retrieval, set coverage, and the separation of retrieval failure from answering failure.
- [TIME: A Multi-level Benchmark for Temporal Reasoning of LLMs in Real-World Scenarios](https://arxiv.org/abs/2505.12891) informs dense temporal, changing-event, and social-interaction time probes.
- [Do LLMs Recognize Your Preferences? (PrefEval)](https://openreview.net/forum?id=QWunLKbBGF) informs explicit and implicit preference inference, memory, and adherence tests.
- [AlpsBench: An LLM Personalization Benchmark for Real-Dialogue Memorization and Preference Alignment](https://arxiv.org/abs/2603.26680) informs independent evaluation of extraction, updating, retrieval, and response utilization, including emotional resonance.
- [How Does Personalized Memory Shape LLM Behavior? (RPEval)](https://arxiv.org/abs/2601.16621) informs pragmatic applicability decisions that prevent irrelevant memory from distorting current intent.
- [BenchPreS: Context-Aware Personalized Preference Selectivity](https://arxiv.org/abs/2603.16557) informs preference-scope and suppression gates and the measurement of over-application.
- [A-MBER: Affective Memory Benchmark for Emotion Recognition](https://arxiv.org/abs/2604.07017) informs grounded interpretation of present affect from long-range history, adversarial evidence, and insufficient-evidence behavior.
- [ENPMR-Bench: Benchmarking Proactive Memory Retrieval for Emotional Support Agents](https://aclanthology.org/2026.findings-acl.2080/) informs emotional-need-aware supportive retrieval without making Rosebud a clinical product.
- [StratMem-Bench: Evaluating Strategic Memory Use Beyond Factual Recall](https://aclanthology.org/2026.acl-long.1491/) informs required, supportive, irrelevant, and conditionally inappropriate memory-use decisions.
- [Mem2ActBench: Long-Term Memory Utilization in Task-Oriented Autonomous Agents](https://aclanthology.org/2026.acl-long.370/) informs implicit activation of previously established constraints instead of requiring explicit recall questions.
- [TriggerBench: Investigating Prospective Memory for Large Language Models](https://arxiv.org/abs/2606.23459) informs proactive recall, matched negative cases, false-alarm measurement, and attentional-overload probes.
- [Personalize-then-Store (PerMemBench)](https://arxiv.org/abs/2605.25535) informs personalized promotion of derived memory while its unresolved gating problem supports retaining all eligible raw evidence.
- [Hindsight is 20/20: Building Agent Memory that Retains, Recalls, and Reflects](https://arxiv.org/abs/2512.12818) informs epistemic separation, temporal entity graphs, parallel semantic/lexical/graph/temporal retrieval, Reciprocal Rank Fusion, strong reranking, and source-aware reflection. Rosebud does not adopt autonomous opinions as user truth.
- [APEX-MEM: Agentic Semi-Structured Memory with Temporal Reasoning](https://aclanthology.org/2026.acl-long.749/) informs append-only event preservation, retrieval-time conflict resolution, and structured temporal query tools.
- [Mitigating Provenance-Role Collapse via Typed Memory Representation (MemIR)](https://arxiv.org/abs/2605.25869) informs the strict separation of raw evidence, retrieval cues, and fact-authorizing claims.
- [MemMachine: A Ground-Truth-Preserving Memory System](https://arxiv.org/abs/2604.04853) informs full-episode preservation, exact surrounding-context expansion, and adaptive direct, decomposed, and iterative retrieval.
- [MemORAI: Adaptive Graph Intelligence for Conversational Memory](https://aclanthology.org/2026.findings-acl.1408/) informs turn-level provenance, query-adaptive graph retrieval, and protection against information dilution.
- [AdaMem: Adaptive User-Centric Memory for Long-Horizon Dialogue Agents](https://arxiv.org/abs/2603.16496) informs target-participant resolution, question-conditioned route planning, selective graph expansion, and evidence-synthesis role separation.
- [MemCog: From Memory-as-Tool to Memory-as-Cognition](https://arxiv.org/abs/2605.28046) informs proactive, reasoning-driven navigation rather than one-shot flat retrieval.
- [Remember When It Matters: Proactive Memory Agent for Long-Horizon Agents](https://arxiv.org/abs/2607.08716) informs selective memory intervention and a valid no-op/silence decision instead of passive or always-on injection.
- [Inside Out: Evolving User-Centric Core Memory Trees](https://aclanthology.org/2026.acl-long.614/) informs bounded structured profile growth and interpretable memory operations; Rosebud retains immutable evidence and treats the profile as a rebuildable projection.
- [Controllable Memory Usage: Balancing Anchoring and Innovation (SteeM)](https://aclanthology.org/2026.acl-long.670/) informs turn-level memory dependence and fresh-eyed versus continuity-heavy response modes.
- [Memory Beyond Recall: A Dual-Process Cognitive Memory System](https://arxiv.org/abs/2606.09483) informs synchronous evidence capture, asynchronous schema induction, supersession chains, and cross-domain collision review while keeping schemas in the hypothesis plane.
- [Re3: Relevance and Recency Retrieval for Mitigating Temporal Hallucination](https://aclanthology.org/2026.acl-long.1180/) informs conflict-aware freshness handling for changing external-world facts.
- [NIST AI Risk Management Framework 1.0](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-ai-rmf-10) informs the govern/map/measure/manage lifecycle, traceability, measured release gates, and continuous model/version review.
- [WHO: Towards responsible AI for mental health and well-being](https://www.who.int/news/item/20-03-2026-towards-responsible-ai-for-mental-health-and-well-being--experts-chart-a-way-forward) informs the insistence on accountability, human well-being, explicit governance, and dedicated safeguards for AI used during emotional vulnerability even though Rosebud is positioned as a non-clinical journaling companion.
