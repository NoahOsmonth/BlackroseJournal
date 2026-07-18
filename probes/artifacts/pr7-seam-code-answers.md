# PR7 seam — code answers (Part 1 §3)

## (a) Confirm re-stamps `source` to `"manual"`

**Yes — `confirmIdentityPendingField` hardcodes `source: 'manual'`** when promoting `pendingCandidate` → `value` via `mergeField(..., 'manual', now, 'user confirmed pending identity candidate', true)`.

### Every place that branches on identity field `source`

| Location | Behavior |
|---|---|
| `services/memory/identityProfile.ts` → `applyIdentityPatch` | `const forceApply = patch.forceApply === true \|\| source === 'manual'`. When `source === 'manual'`, contradicting scalar patches **overwrite** immediately (Settings typed edit). Extraction/tool defaults (`source` default `'extraction'`) go to `pendingCandidate` only. |
| `services/memory/identityProfile.ts` → `confirmIdentityPendingField` | Always writes with `source: 'manual'` + `forceApply: true` (via mergeField 5th/6th args). |
| `services/memory/identityProfile.ts` → `mergeField` | Does **not** branch on `source` for pending vs apply — only on `forceApply`. Source is stored for audit / reinforce path. On reinforce (same value), keeps existing source if existing confidence ≥ new. |
| `services/memory/identityProfile.ts` → load/validate | `isValidFieldSource` accepts `'extraction' \| 'tool' \| 'manual' \| 'system'`. |
| `services/memory/identityProfile.types.ts` | Documents `source` enum; `IdentityPatch.source` optional. |
| Prompt / UI | **Do not** branch on field source. `formatIdentityContext` only prints `value`. Settings rows show values, not source labels. |

**Is the label correct?**  
Mostly yes for product semantics: Confirm is an **explicit user supersede**, same force-apply class as Settings manual edit. Slightly imprecise if `"manual"` is read as “user typed the string” — Confirm promotes an **extraction** candidate the user never typed. Audit trail still preserves prior revision with `source: 'extraction'` under `previousValues`. Alternative label would be `'user_confirm'`; not required for forceApply which is the real gate.

*(Note: `localMemory.ts` `atom.source === 'manual'` is a different domain — memory atoms, not identity fields.)*

## (b) Dismiss bumps field `updatedAt` without changing value

**Yes — intended as “pending resolved” bookkeeping.**

`dismissIdentityPendingField`:
1. Strips `pendingCandidate` only.
2. Sets `field.updatedAt = now` and `profile.updatedAt = now`.
3. Leaves `value`, `confidence`, `source` unchanged.

### Anything that **reads** field `updatedAt`

| Reader | Role |
|---|---|
| `mergePeople` / `mergeFacts` sorts | `b.updatedAt - a.updatedAt` for people/facts lists (not scalar preferredName) |
| `mergeField` forceApply | Copies existing field `updatedAt` into `previousValues` revision before supersede |
| Load/parse validators | Require finite `updatedAt` on fields/revisions |
| Profile-level `updatedAt` | Touched on any mutation (confirm, dismiss, patch) |

**Nothing in production UI or prompt formatting sorts or displays scalar field `updatedAt`.**  
Bumping on dismiss is still useful for: (1) consistent “profile touched” signal, (2) future “last identity activity” UX, (3) distinguishing “pending cleared today” vs stale fields if you later rank by freshness. Not a bug; low-risk audit stamp.
