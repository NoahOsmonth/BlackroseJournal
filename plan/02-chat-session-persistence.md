# WS1 — Chat Session Persistence (The Lost-Session Bug)

> **Depends on:** nothing (land before WS2). **Priority:** highest user-visible value — this is the bug the user led with.
> **Goal:** An interrupted chat is never silently lost. Leaving by *any* means (back gesture, tab switch, FAB relaunch, app background, crash) preserves the conversation, and the user can resume it.

---

## Root cause (verified, with line numbers)

Chat messages live **only in ephemeral React state**:
- `features/chat/hooks/useChatOrchestration.ts:109` — `const [messages, setMessages] = useState<Message[]>([])`
- `services/ai/useChat.ts:41` — `const messagesRef = useRef<Message[]>([])` (in-memory buffer)

The **only** persistence path is `handleClose()` in `app/chat.tsx:140-170`, which saves a draft *only* when invoked. And `handleClose` is wired **exclusively** to the `Header` X button (`app/chat.tsx:254` → `components/Header.tsx`). There is:
- **No `useEffect` cleanup** that saves on unmount (the only effect, `app/chat.tsx:104-133`, *loads* by id; it never saves).
- **No `useFocusEffect`** to catch navigation-away.
- **No autosave** on message append.

So when the user taps **+** (FAB → `router.push('/chat')`, `app/(tabs)/entries.tsx:84` and `app/(tabs)/today.tsx:259`), chats, then presses the **system back button / swipe** (not the X), the component unmounts and React GCs `messages`. Tapping **+** again mounts a fresh `/chat` (no `entryId`), and `conversationId = chat_${Date.now()}` is regenerated (`app/chat.tsx:62-65`), so even the backend long-term memory can't be re-linked. **The session is gone.**

`app/intentions/chat.tsx` is *partially* better — its `handleClose` (`:206-252`) saves a check-in draft — but it has the **same** "only fires on the explicit close button" flaw (`:379`), so a back-gesture there loses the check-in too.

---

## Design decision: a dedicated session store, NOT the draft path

Drafts (`status:'draft'` journal entries) are an **explicit user artifact** the user chose to keep. In-flight sessions are **autosave / crash-recovery** — a different lifecycle. Conflating them (today's behavior: `handleClose` writes a `status:'draft'` entry) is exactly why recovery is confusing and why an abandoned 2-message chat pollutes the drafts list. We separate them:

- **Session store** = ephemeral, auto-managed, keyed by `conversationId`, pruned aggressively (e.g., keep last N or last 7 days, drop on finish).
- **Drafts** = unchanged semantics (explicit "save for later"), but the Drafts screen *also surfaces* active sessions in a separate section so recovery is discoverable.

---

## Deliverables

### 1.1 `services/ai/sessionStorage.ts` (new)

AsyncStorage-backed store of in-progress sessions, mirroring the structure of `services/ai/customModels.ts` (storage adapter pattern, sanitize-on-read).

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Message } from './chatTypes';

export type ChatSessionMode = 'freeform' | 'dailyCheckIn' | 'continue'
  | 'intention' | 'morning' | 'evening';

export interface ChatSession {
  conversationId: string;
  mode: ChatSessionMode;
  messages: Message[];
  personaId?: string;
  /** Route params needed to faithfully resume (entryId, area, intentionId, type). */
  routeParams?: Record<string, string>;
  updatedAt: number;
  createdAt: number;
}

export const CHAT_SESSIONS_KEY = '@blackrose_chat_sessions';
const MAX_SESSIONS = 10;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// load all, get by id, upsert (debounced by caller), remove(conversationId),
// getMostRecentActive(): ChatSession | null  (newest, non-empty, within MAX_AGE),
// pruneStale(): drop > MAX_AGE or beyond MAX_SESSIONS by updatedAt.
// All functions sanitize and never throw to the caller (return safe defaults).
```

Key functions: `loadSessions()`, `getSession(id)`, `saveSession(session)`, `removeSession(id)`, `getMostRecentActiveSession()`, `pruneStaleSessions()`. Inject a storage adapter (like `setCustomModelStorageAdapter`) so it's unit-testable.

### 1.2 Autosave inside `useChatOrchestration` (the durable fix)

This is independent of unmount timing — it persists as the conversation grows, so even a hard crash loses at most the last message.

In `features/chat/hooks/useChatOrchestration.ts`:
- Accept new options: `persistKey?: { conversationId; mode; personaId?; routeParams? }` (or, after WS2, derive from the `ChatFlow`).
- Add a **debounced effect** (e.g., 600ms) that calls `saveSession(...)` whenever `messages` changes and `messages.length > 0`.
- Expose `clearPersistedSession()` to call on finish/discard.
- Call `pruneStaleSessions()` once on mount.

> Because **both** `app/chat.tsx` and `app/intentions/chat.tsx` use this hook, autosave fixes session loss for **both** surfaces at once. This is the single highest-leverage change in WS1.

### 1.3 Lifecycle flush in the screens (redundancy + correctness)

In `app/chat.tsx` (and mirror in `app/intentions/chat.tsx`):
- Add `useFocusEffect` (from `@react-navigation/native`) returning a cleanup that flushes the current `messages` to `sessionStorage` on **blur** — catches tab switches and back navigation that a fast unmount might race.
- Add a `useEffect(() => () => flush(), [])` unmount cleanup as a belt-and-suspenders backup.
- **Persist `conversationId`**: stop regenerating per mount when resuming. On mount, if a `resume` param or an active session for this surface exists, restore its `conversationId` so backend memory re-links (fixes `app/chat.tsx:62-65` + `services/ai/useChat.ts:43`).

### 1.4 Resume UX

**Entries screen** (`app/(tabs)/entries.tsx`):
- On focus, call `getMostRecentActiveSession()`. If present, render a dismissible **"Resume your last conversation"** banner above the feed (new `components/journal/ResumeSessionBanner.tsx`) → tapping routes to `/chat?resume=<conversationId>` (or `/intentions/chat` with the saved route params).

**FAB behavior** (`components/journal/FAB.tsx` / `BottomNav` FAB + `today.tsx`/`entries.tsx` `onFabPress`):
- If an active session exists, the FAB offers **Resume vs. New** (small action sheet) instead of always launching empty. Default tap = new chat *only after* confirming the active one is safely autosaved (it is, via 1.2).

**Chat screen resume**:
- `app/chat.tsx` reads a `resume` param; if set, loads the session from `sessionStorage` and calls `initializeMessages(session.messages)` + restores `conversationId`.

### 1.5 Drafts screen split

`app/drafts.tsx` currently lists only explicit drafts (journal `status:'draft'` + check-in drafts, `:34-56`). Restructure into two labeled sections:
- **"Active"** — autosaved sessions from `sessionStorage` (tap = resume; swipe/delete = `removeSession`).
- **"Saved drafts"** — the current explicit-draft list, unchanged.

This makes recovery discoverable even if the banner is dismissed.

---

## Files touched

| File | Change |
|---|---|
| `services/ai/sessionStorage.ts` | **new** — session persistence service |
| `features/chat/hooks/useChatOrchestration.ts` | debounced autosave, `clearPersistedSession`, prune-on-mount, persist `conversationId` |
| `app/chat.tsx` | `useFocusEffect`+unmount flush, `resume` param handling, restore `conversationId`; clear session on finish/discard |
| `app/intentions/chat.tsx` | same lifecycle flush + resume handling |
| `app/(tabs)/entries.tsx` | resume banner on focus |
| `components/journal/ResumeSessionBanner.tsx` | **new** |
| `components/journal/FAB.tsx` + `BottomNav` FAB callers | resume-vs-new affordance |
| `app/drafts.tsx` | Active vs Saved-drafts sections |

> On **finish** (`handleFinishEntry`, `app/chat.tsx:172-237`; `handleFinish`, `app/intentions/chat.tsx:254-328`) and on explicit **discard**, call `removeSession(conversationId)` so completed work doesn't linger as an "active" session.

---

## Tests

- `__tests__/services/ai/sessionStorage.test.ts` (new): upsert/get/remove; `getMostRecentActiveSession` ignores empty + stale; `pruneStaleSessions` drops > 7d and beyond cap; sanitize bad JSON → safe default.
- `__tests__/hooks/useChatOrchestration.session.test.ts` (new): appending messages triggers a debounced `saveSession`; `handleNewChat`/finish clears it; `conversationId` preserved across re-init.
- `__tests__/screens/ChatResume.test.tsx` (new): mounting `/chat?resume=<id>` restores messages + `conversationId`.
- Update existing chat tests (`__tests__/ChatMessage.test.tsx`, any ChatScreen test) for the new footer/structure if changed by WS0.

---

## Acceptance criteria (screenshot QA — the user's explicit test)

1. `npm run dev`; open chat via **+**; send a message; get a reply.
2. Press the **system back** (not the X). Return to Entries → **Resume banner appears**.
3. Tap **+** again → resume-vs-new prompt; choosing resume restores the full conversation (and `conversationId`).
4. Repeat with a **tab switch** instead of back — session still recoverable.
5. Repeat in `intentions/chat` (morning check-in) — back-gesture mid-conversation, session recoverable.
6. Finishing an entry removes it from the Active list (no orphan sessions).
7. Drafts screen shows Active vs Saved sections correctly.
8. All automated gates green.
