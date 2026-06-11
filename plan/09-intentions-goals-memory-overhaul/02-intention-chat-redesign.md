# Phase B — Morning/Evening intention chat redesign (unify with the `+` button chat)

## Product requirement (verbatim intent)

The morning and evening intention flow must get the **same "dig deeper" interaction and design as the `+` button journal chat**, while **still saving as a morning or evening intention check-in** (`IntentionCheckIn` with `type: 'morning' | 'evening'`), NOT as a `JournalEntry`.

Concretely after this phase, `/intentions/chat?type=morning|evening`:

1. Uses the **same footer design** as the journal chat: primary filled "Go deeper" button + secondary "Finish entry" button (`components/FooterActions.tsx` look), replacing the old bordered "Finish entry"/"Suggest" pair.
2. Uses the **same animated input** (`components/InlineTypingInput.tsx`) instead of a bare `TextInput`.
3. Shows a **typing indicator** while the AI responds (the old screen showed nothing during `isLoading` before streaming starts).
4. Generates an **AI title** on finish (like the journal flow's `generateEntryTitle`), falling back to the first-user-message summary when AI fails. Saving still goes through `finishIntentionChat` → `createCheckIn`/`updateCheckIn` with the correct `type`.
5. Keeps everything intention-specific: morning/evening system prompts, persona selector, per-message feedback thumbs, play/copy/share, draft autosave, resume, completion tracking on the Today screen.

No route changes. No storage-shape changes other than an optional `title` override parameter.

Touched files:

| File | Action |
|---|---|
| `components/intentions/IntentionChatFooter.tsx` | Full replacement (becomes a thin wrapper around `FooterActions`) |
| `components/intentions/IntentionChatBody.tsx` | Full replacement (InlineTypingInput + typing indicator + gap classes) |
| `app/intentions/chat.tsx` | Targeted edits (state, handlers, JSX wiring) |
| `services/intentions/intentionChatCompletion.ts` | Add optional `title` override |
| `__tests__/...` | Update/add tests (Task B6) |

---

## Task B1 — Replace `components/intentions/IntentionChatFooter.tsx`

Write the file with exactly this content (full replacement):

```tsx
import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FooterActions } from '@/components/FooterActions';

interface IntentionChatFooterProps {
    isMuted: boolean;
    onToggleMuted: () => void;
    onGoDeeper: () => void;
    onFinishEntry: () => void;
    disabled?: boolean;
    canGoDeeper?: boolean;
    canFinish?: boolean;
}

export function IntentionChatFooter({
    isMuted,
    onToggleMuted,
    onGoDeeper,
    onFinishEntry,
    disabled = false,
    canGoDeeper = false,
    canFinish = false,
}: IntentionChatFooterProps) {
    const isDark = useColorScheme() === 'dark';
    const mutedIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;
    const activeIconColor = isDark ? Colors.dark.primary : Colors.light.primary;

    return (
        <View className="bg-background-light dark:bg-background-dark">
            <View className="flex-row items-center justify-between px-5 pb-3">
                <Text className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                    Note: Rosebud can make mistakes
                </Text>
                <Pressable accessibilityLabel="Toggle volume" onPress={onToggleMuted} hitSlop={8}>
                    <MaterialIcons
                        name={isMuted ? 'volume-off' : 'volume-up'}
                        size={22}
                        color={isMuted ? mutedIconColor : activeIconColor}
                    />
                </Pressable>
            </View>
            <FooterActions
                onGoDeeper={onGoDeeper}
                onFinishEntry={onFinishEntry}
                disabled={disabled}
                canGoDeeper={canGoDeeper}
                canFinish={canFinish}
            />
        </View>
    );
}
```

Why a wrapper instead of a copy: `FooterActions` IS the `+` button design (primary `bg-primary` "Go deeper" with south icon, secondary bordered "Finish entry" with check icon, disabled-opacity states, home-indicator bar). Reusing it guarantees the two surfaces stay pixel-identical and is the AGENTS.md-sanctioned pattern (shared primitives over per-screen forks).

---

## Task B2 — Replace `components/intentions/IntentionChatBody.tsx`

Write the file with exactly this content (full replacement). Changes vs. old file: bare `TextInput` → `InlineTypingInput` (ref-controlled), new `isLoading` typing indicator, dead `space-x-2`/`space-y-4` → `gap-2`/`gap-4`, new `flowLabel` prop replacing the hardcoded "Intention Setting" label.

```tsx
import React from 'react';
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Pressable,
    ScrollView,
    Text,
    View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Message } from '@/services/ai/ai';
import type { StreamingMessage } from '@/features/chat';
import { InlineTypingInput, InlineTypingInputRef } from '@/components/InlineTypingInput';
import { IntentionChatMessage } from './IntentionChatMessage';

interface IntentionChatBodyProps {
    readonly scrollViewRef: React.RefObject<ScrollView | null>;
    readonly inputRef: React.Ref<InlineTypingInputRef>;
    readonly flowLabel: string;
    readonly headerDate: string;
    readonly messages: readonly Message[];
    readonly streamingMessage: StreamingMessage | null;
    readonly isLoading: boolean;
    readonly feedback: Record<string, 'up' | 'down'>;
    readonly onSubmitInput: (text: string) => void;
    readonly onInputTextChange: (text: string) => void;
    readonly onSettingsPress: () => void;
    readonly onPlay: (text: string) => void;
    readonly onCopy: (text: string) => void;
    readonly onShare: (text: string) => void;
    readonly onThumb: (id: string, value: 'up' | 'down') => void;
    readonly onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    readonly onContentSizeChange?: () => void;
}

export function IntentionChatBody({
    scrollViewRef,
    inputRef,
    flowLabel,
    headerDate,
    messages,
    streamingMessage,
    isLoading,
    feedback,
    onSubmitInput,
    onInputTextChange,
    onSettingsPress,
    onPlay,
    onCopy,
    onShare,
    onThumb,
    onScroll,
    onContentSizeChange,
}: IntentionChatBodyProps) {
    const colorScheme = useColorScheme();
    const isDark = colorScheme === 'dark';
    const settingsIconColor = isDark ? Colors.dark.tabIconDefault : Colors.light.tabIconDefault;

    return (
        <ScrollView
            ref={scrollViewRef}
            className="flex-1 px-5 pt-4 pb-20"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScroll={onScroll}
            scrollEventThrottle={80}
            onContentSizeChange={onContentSizeChange}
        >
            <View className="flex-row items-center gap-2 mb-4">
                <Text className="text-[10px] font-bold tracking-wider text-text-secondary-light dark:text-text-secondary-dark uppercase">
                    {flowLabel} - {headerDate}
                </Text>
                <Pressable onPress={onSettingsPress} accessibilityLabel="Open persona settings">
                    <MaterialIcons name="settings" size={12} color={settingsIconColor} />
                </Pressable>
            </View>

            <View className="gap-4">
                {messages.map((message) => (
                    <IntentionChatMessage
                        key={message.id}
                        message={message}
                        feedback={feedback[message.id]}
                        onPlay={onPlay}
                        onCopy={onCopy}
                        onShare={onShare}
                        onThumb={onThumb}
                    />
                ))}

                {streamingMessage && (
                    <Text className="text-[17px] leading-relaxed text-accent-blue dark:text-ai-text">
                        {streamingMessage.content}
                    </Text>
                )}

                {isLoading && !streamingMessage && (
                    <View className="flex-row items-center gap-2 py-1" accessibilityLabel="Rosebud is thinking">
                        <ActivityIndicator size="small" color={settingsIconColor} />
                        <Text className="text-[13px] text-text-secondary-light dark:text-text-secondary-dark">
                            Thinking...
                        </Text>
                    </View>
                )}
            </View>

            <View className="mt-8 pb-6">
                <InlineTypingInput
                    ref={inputRef}
                    onSubmit={onSubmitInput}
                    onTextChange={onInputTextChange}
                    disabled={isLoading}
                    placeholder="Write"
                />
            </View>
        </ScrollView>
    );
}
```

Behavioral notes the executor must understand (do not change these semantics):
- `InlineTypingInput` owns its own text state. On submit (Enter / send) it calls `onSubmit(trimmed)` and then clears itself, which fires `onTextChange('')` — so the screen's `inputValue` state stays in sync automatically.
- The screen-level `inputValue` mirror exists for two reasons: enabling "Go deeper"/"Finish entry" buttons (`canGoDeeper`), and `withPendingInput` so unsent typed text is included in drafts/finishes.
- The old file imported `Message` from `'@/services/ai/ai'` — keep that exact path.

---

## Task B3 — Edit `app/intentions/chat.tsx`

Six targeted edits. Line numbers refer to the pre-edit file.

### B3.1 — imports

FIND:
```tsx
import {
    finishIntentionChat,
    saveIntentionChatDraft,
} from '@/services/intentions/intentionChatCompletion';
```
REPLACE WITH:
```tsx
import {
    finishIntentionChat,
    saveIntentionChatDraft,
    withPendingInput,
} from '@/services/intentions/intentionChatCompletion';
```

Then add the AI title import. **First open `app/chat.tsx` and find the exact import line for `generateEntryTitle`** (it is in the import block near the top; it comes from the AI services layer). Copy that exact import statement into `app/intentions/chat.tsx`'s import block. Do not guess the path — copy it from `app/chat.tsx`.

### B3.2 — new state + derived values

FIND:
```tsx
    const [isMuted, setIsMuted] = useState(false);
```
REPLACE WITH:
```tsx
    const [isMuted, setIsMuted] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
```

FIND:
```tsx
    const checkInType = (typeParam as IntentionCheckInType) ?? 'intention';
```
REPLACE WITH:
```tsx
    const checkInType = (typeParam as IntentionCheckInType) ?? 'intention';
    const trimmedInput = inputValue.trim();
    const flowLabel = checkInType === 'morning'
        ? 'Morning Intention'
        : checkInType === 'evening' ? 'Evening Reflection' : 'Intention Setting';
```

(`inputValue` is declared above this point in the file — line ~58 — so the ordering is valid.)

### B3.3 — replace `handleSuggest` with `handleGoDeeper` + `handleSubmitInput`

FIND (lines ~327-335):
```tsx
    const handleSuggest = useCallback(async () => {
        if (!inputValue.trim() || isLoading) {
            return;
        }
        const text = inputValue.trim();
        setInputValue('');
        clearError();
        await handleSendMessage(text);
    }, [clearError, handleSendMessage, inputValue, isLoading]);
```
REPLACE WITH:
```tsx
    const handleSubmitInput = useCallback(async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || isLoading) {
            return;
        }
        setInputValue('');
        clearError();
        await handleSendMessage(trimmed);
    }, [clearError, handleSendMessage, isLoading]);

    const handleGoDeeper = useCallback(async () => {
        if (!trimmedInput || isLoading) {
            return;
        }
        const text = trimmedInput;
        setInputValue('');
        inputRef.current?.clear();
        clearError();
        await handleSendMessage(text);
    }, [clearError, handleSendMessage, isLoading, trimmedInput]);
```

(`inputRef` already exists in the file: `const inputRef = useRef<InlineTypingInputRef>(null);` line ~46, and the `InlineTypingInputRef` type is already imported.)

### B3.4 — rewrite `handleFinish` (AI title + saving guard)

FIND (the entire existing `handleFinish` callback, lines ~276-325 — from `const handleFinish = useCallback(async () => {` through its closing `]);`):
```tsx
    const handleFinish = useCallback(async () => {
        if (!hasContent(messages) && !inputValue.trim()) {
            return;
        }

        finalize();
        const { resolvedIntention } = await finishIntentionChat({
            messages,
            inputValue,
            draftCheckInId,
            intentionId,
            checkInType,
            personaId: activePersona?.id,
            intention,
            areaParam,
            isRefineMode,
        });

        if (resolvedIntention && checkInType === 'intention') {
            await markIntentionGoalComplete(
                resolvedIntention.title,
                getLocalDateKey(new Date()),
                resolvedIntention.id
            );
        }

        // Completed check-in must not linger as an active session.
        await removeSession(conversationId);

        handleNewChat();
        if (resolvedIntention) {
            router.replace({ pathname: '/intentions/detail', params: { id: resolvedIntention.id } });
        } else {
            router.replace('/(tabs)/today');
        }
    }, [
        activePersona?.id,
        areaParam,
        checkInType,
        conversationId,
        draftCheckInId,
        finalize,
        handleNewChat,
        inputValue,
        intention,
        intentionId,
        isRefineMode,
        messages,
        router,
    ]);
```
REPLACE WITH:
```tsx
    const handleFinish = useCallback(async () => {
        if ((!hasContent(messages) && !inputValue.trim()) || isSaving) {
            return;
        }

        finalize();
        setIsSaving(true);
        try {
            const finalMessages = withPendingInput(messages, inputValue);
            const entryText = finalMessages
                .filter((message) => message.role === 'user')
                .map((message) => message.content)
                .join('\n\n');

            let generatedTitle: string | undefined;
            if (entryText.trim()) {
                try {
                    generatedTitle = await generateEntryTitle({ entryText });
                } catch (error) {
                    console.warn('AI title generation failed, using summary fallback', error);
                }
            }

            const { resolvedIntention } = await finishIntentionChat({
                messages,
                inputValue,
                draftCheckInId,
                intentionId,
                checkInType,
                personaId: activePersona?.id,
                intention,
                areaParam,
                isRefineMode,
                title: generatedTitle,
            });

            if (resolvedIntention && checkInType === 'intention') {
                await markIntentionGoalComplete(
                    resolvedIntention.title,
                    getLocalDateKey(new Date()),
                    resolvedIntention.id
                );
            }

            // Completed check-in must not linger as an active session.
            await removeSession(conversationId);

            handleNewChat();
            if (resolvedIntention) {
                router.replace({ pathname: '/intentions/detail', params: { id: resolvedIntention.id } });
            } else {
                router.replace('/(tabs)/today');
            }
        } finally {
            setIsSaving(false);
        }
    }, [
        activePersona?.id,
        areaParam,
        checkInType,
        conversationId,
        draftCheckInId,
        finalize,
        handleNewChat,
        inputValue,
        intention,
        intentionId,
        isRefineMode,
        isSaving,
        messages,
        router,
    ]);
```

> If `generateEntryTitle` in this repo takes a different argument shape than `{ entryText }`, mirror **exactly** how `app/chat.tsx` calls it (search for `generateEntryTitle(` there) — `app/chat.tsx` is the source of truth for this call.

### B3.5 — JSX wiring

FIND (lines ~379-401):
```tsx
                <IntentionChatBody
                    scrollViewRef={scrollViewRef}
                    headerDate={headerDate}
                    messages={messages}
                    streamingMessage={streamingMessage}
                    feedback={feedback}
                    inputValue={inputValue}
                    onInputChange={setInputValue}
                    onSettingsPress={personaSettings.openActiveSettings}
                    onPlay={handlePlay}
                    onCopy={handleCopy}
                    onShare={handleShare}
                    onThumb={handleThumb}
                    onScroll={handleScroll}
                    onContentSizeChange={() => scrollToBottom()}
                />

                <IntentionChatFooter
                    isMuted={isMuted}
                    onToggleMuted={handleToggleMuted}
                    onFinish={handleFinish}
                    onSuggest={handleSuggest}
                />
```
REPLACE WITH:
```tsx
                <IntentionChatBody
                    scrollViewRef={scrollViewRef}
                    inputRef={inputRef}
                    flowLabel={flowLabel}
                    headerDate={headerDate}
                    messages={messages}
                    streamingMessage={streamingMessage}
                    isLoading={isLoading}
                    feedback={feedback}
                    onSubmitInput={handleSubmitInput}
                    onInputTextChange={setInputValue}
                    onSettingsPress={personaSettings.openActiveSettings}
                    onPlay={handlePlay}
                    onCopy={handleCopy}
                    onShare={handleShare}
                    onThumb={handleThumb}
                    onScroll={handleScroll}
                    onContentSizeChange={() => scrollToBottom()}
                />

                <IntentionChatFooter
                    isMuted={isMuted}
                    onToggleMuted={handleToggleMuted}
                    onGoDeeper={handleGoDeeper}
                    onFinishEntry={handleFinish}
                    disabled={isLoading || isSaving}
                    canGoDeeper={trimmedInput.length > 0}
                    canFinish={hasContent(messages) || trimmedInput.length > 0}
                />
```

### B3.6 — sanity checks after editing this file

- `isLoading` is already destructured from `useChatOrchestration` (line ~168) — no change needed.
- `clearError` is already destructured (line ~170) — no change needed.
- The file must still compile with no unused variables (the old `handleSuggest` is gone, replaced).
- File length must stay ≤ 500 lines (`npm run check:design`).

---

## Task B4 — Add `title` override to `services/intentions/intentionChatCompletion.ts`

### B4.1

FIND:
```ts
interface FinishChatOptions extends SaveDraftOptions {
    intention: Intention | null;
    areaParam?: string;
    isRefineMode: boolean;
}
```
REPLACE WITH:
```ts
interface FinishChatOptions extends SaveDraftOptions {
    intention: Intention | null;
    areaParam?: string;
    isRefineMode: boolean;
    title?: string;
}
```

### B4.2

FIND:
```ts
export async function finishIntentionChat({
    messages,
    inputValue,
    draftCheckInId,
    intentionId,
    checkInType,
    personaId,
    intention,
    areaParam,
    isRefineMode,
}: FinishChatOptions): Promise<FinishChatResult> {
    const finalMessages = withPendingInput(messages, inputValue);
    const summary = buildIntentionChatSummary(finalMessages);
    let resolvedIntention = intention;
```
REPLACE WITH:
```ts
export async function finishIntentionChat({
    messages,
    inputValue,
    draftCheckInId,
    intentionId,
    checkInType,
    personaId,
    intention,
    areaParam,
    isRefineMode,
    title,
}: FinishChatOptions): Promise<FinishChatResult> {
    const finalMessages = withPendingInput(messages, inputValue);
    const summary = buildIntentionChatSummary(finalMessages);
    const checkInTitle = title?.trim() ? title.trim() : summary;
    let resolvedIntention = intention;
```

### B4.3 — use the resolved title in both save branches

FIND:
```ts
        await updateCheckIn(draftCheckInId, {
            messages: finalMessages,
            status: 'completed',
            summary,
            title: summary,
            personaId,
        });
```
REPLACE WITH:
```ts
        await updateCheckIn(draftCheckInId, {
            messages: finalMessages,
            status: 'completed',
            summary,
            title: checkInTitle,
            personaId,
        });
```

FIND:
```ts
        await createCheckIn({
            intentionId: resolvedIntention?.id,
            type: checkInType,
            title: summary,
            summary,
            mood: 'Reflective',
            personaId,
            messages: finalMessages,
            status: 'completed',
        });
```
REPLACE WITH:
```ts
        await createCheckIn({
            intentionId: resolvedIntention?.id,
            type: checkInType,
            title: checkInTitle,
            summary,
            mood: 'Reflective',
            personaId,
            messages: finalMessages,
            status: 'completed',
        });
```

Leave `createIntention` (the `checkInType === 'intention'` branch) and `withPendingInput`/`buildIntentionChatSummary`/`saveIntentionChatDraft` untouched. `withPendingInput` is already exported — verify the `export` keyword is present on it (it is, line 21).

**Why morning/evening completion tracking keeps working:** `app/(tabs)/today.tsx:79-89` marks the cards complete by scanning check-ins for `type === 'morning'|'evening'` with today's `dateKey` — this phase never changes `type`, so the checkmarks still work.

---

## Task B5 — Caller/test impact sweep

Run and resolve each hit:

```bash
grep -rn "onSuggest\|handleSuggest" app components __tests__ features
grep -rn "IntentionChatFooter\|IntentionChatBody" __tests__ components app
grep -rn "onInputChange" components/intentions __tests__
```

- Any test rendering `IntentionChatFooter` must be updated to the new props (`onGoDeeper`, `onFinishEntry`, `disabled`, `canGoDeeper`, `canFinish`) and to assert the new button labels: **"Go deeper"** and **"Finish entry"** (the "Suggest" label no longer exists).
- Any test rendering `IntentionChatBody` must be updated: prop `inputValue`/`onInputChange` → `inputRef`/`onSubmitInput`/`onInputTextChange`/`isLoading`/`flowLabel`, and the input is now found by placeholder `"Write"` or by the `InlineTypingInput` testing approach used in existing chat-screen tests (check `__tests__` for how `app/chat.tsx` tests interact with `InlineTypingInput`, and mirror it). The old `testID="intention-chat-input"` is gone.
- If snapshot tests exist for these components, regenerate after manual review of the diff.

## Task B6 — New tests (required)

Create/extend tests covering, at minimum:

1. **`IntentionChatFooter`** renders "Go deeper" and "Finish entry"; pressing each fires the right callback; with `canGoDeeper={false}` pressing "Go deeper" does NOT fire (FooterActions disables it); with `disabled` both are inert.
2. **`finishIntentionChat` title override** (extend the existing suite for `intentionChatCompletion` if present, else create `__tests__/services/intentionChatCompletion.test.ts` following repo mock patterns for `intentionsStorage`): when `title: 'AI Title'` is passed with a fresh (no-draft) morning check-in, `createCheckIn` receives `title: 'AI Title'`, `type: 'morning'`, `summary` = first-user-message excerpt; when `title` is `undefined` or whitespace, `createCheckIn` receives `title === summary`.
3. **`IntentionChatBody`** shows the "Thinking..." indicator when `isLoading && !streamingMessage`, and hides it when a `streamingMessage` is present.

Follow the repo test conventions: files named `<Subject>.test.tsx`, ≤300 lines, user-centric queries (visible text / a11y labels).

---

## Phase B verification

```bash
npx tsc --noEmit
npm run lint
npm run check:design
npm test
```

Manual QA script (run app, requires backend per AGENTS.md if AI is exercised):
1. Today tab → tap "Morning Intention" card → screen shows "MORNING INTENTION - <date>" pill, AI opening message, animated input.
2. Type a reply → "Go deeper" enables (primary orange button, south icon) → tap → message sends, "Thinking..." indicator shows, AI replies.
3. Type more → press Enter/submit on the input — same behavior as "Go deeper".
4. Tap "Finish entry" → button row disables while saving → lands on Today tab → Morning card shows completed checkmark.
5. Repeat for "Evening Reflection" → check-in saved with type `evening` (verify in History/check-in detail that the title is AI-generated, not just the first message).
6. Close mid-conversation → draft is recoverable from Drafts.
7. Toggle dark mode → all new text/icons visible.

Update `PROGRESS.md`.
