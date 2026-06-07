import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    ScrollView,
    View,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import * as Clipboard from 'expo-clipboard';

import { useChatOrchestration } from '@/features/chat';
import { InlineTypingInputRef } from '@/components/InlineTypingInput';
import { usePersonas } from '@/hooks/personas/usePersonas';
import { useIntentionCheckIns } from '@/hooks/intentions/useIntentionCheckIns';
import { useIntentions } from '@/hooks/intentions/useIntentions';
import { buildIntentionSystemPrompt } from '@/services/intentions/intentionPrompts';
import {
    createCheckIn,
    getCheckIn,
    getIntention,
    updateCheckIn,
} from '@/services/intentions/intentionsStorage';
import { Intention, IntentionArea, IntentionCheckInType } from '@/services/intentions/intentionsStorage.types';
import { getIntentionAreaConfig } from '@/constants/intentions';
import { hasContent } from '@/hooks/journal/useEntryUtils';
import { markIntentionGoalComplete } from '@/services/goals/goalsStorage';
import { PersonaSheet } from '@/components/personas/PersonaSheet';
import { PersonaSettingsSheet } from '@/components/personas/PersonaSettingsSheet';
import { FeedbackCommentModal } from '@/components/intentions/FeedbackCommentModal';
import { getLocalDateKey } from '@/utils/date';
import { IntentionChatHeader } from '@/components/intentions/IntentionChatHeader';
import { IntentionChatFooter } from '@/components/intentions/IntentionChatFooter';
import { IntentionChatBody } from '@/components/intentions/IntentionChatBody';
import { useAiFeedback } from '@/hooks/feedback/useAiFeedback';
import { useIntentionFeedbackModal } from '@/hooks/feedback/useIntentionFeedbackModal';
import type { AiFeedbackValue } from '@/services/feedback/feedbackStorage';
import { usePersonaSettingsActions } from '@/hooks/personas/usePersonaSettingsActions';

function buildSummary(messages: { role: string; content: string }[]): string {
    const first = messages.find((m) => m.role === 'user');
    if (!first) return 'No summary yet.';
    const text = first.content.trim();
    return text.length > 160 ? `${text.slice(0, 160).trim()}...` : text;
}

export default function IntentionChatScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRef = useRef<InlineTypingInputRef>(null);

    const {
        personas,
        activePersona,
        setActive,
        remove,
        isLoading: isPersonasLoading,
    } = usePersonas();
    const { completed: checkIns } = useIntentionCheckIns();
    const { create: createIntention } = useIntentions();

    const [intention, setIntention] = useState<Intention | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [draftCheckInId, setDraftCheckInId] = useState<string | null>(null);
    const [draftUpdatedAt, setDraftUpdatedAt] = useState<number | null>(null);
    const [personaSheetOpen, setPersonaSheetOpen] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const areaParam = Array.isArray(params.area) ? params.area[0] : params.area;
    const intentionId = Array.isArray(params.intentionId) ? params.intentionId[0] : params.intentionId;
    const typeParam = Array.isArray(params.type) ? params.type[0] : params.type;
    const draftIdParam = Array.isArray(params.draftId) ? params.draftId[0] : params.draftId;

    const checkInType = (typeParam as IntentionCheckInType) ?? 'intention';
    const areaConfig = areaParam ? getIntentionAreaConfig(areaParam as IntentionArea) : undefined;

    useEffect(() => {
        let isActive = true;
        const load = async () => {
            if (!intentionId) return;
            const loaded = await getIntention(intentionId);
            if (!isActive) return;
            setIntention(loaded);
        };
        load();
        return () => {
            isActive = false;
        };
    }, [intentionId]);

    const memorySummary = useMemo(() => {
        if (!intentionId) return undefined;
        const latest = checkIns.find((item) => item.intentionId === intentionId);
        return latest?.summary;
    }, [checkIns, intentionId]);

    const conversationId = useMemo(() => {
        if (draftCheckInId) return draftCheckInId;
        if (intentionId) return `intention_${intentionId}_${Date.now()}`;
        return `intention_${Date.now()}`;
    }, [draftCheckInId, intentionId]);

    const {
        feedbackByMessageId,
        guidance: feedbackGuidance,
        isLoading: isFeedbackLoading,
        save: saveFeedback,
    } = useAiFeedback({
        scope: 'intention',
        personaId: activePersona?.id,
        conversationId,
    });

    const feedback = useMemo<Record<string, AiFeedbackValue>>(() => Object.fromEntries(
        Object.entries(feedbackByMessageId).map(([id, record]) => [id, record.value])
    ) as Record<string, AiFeedbackValue>, [feedbackByMessageId]);

    const systemPrompt = useMemo(
        () => buildIntentionSystemPrompt({
            type: checkInType,
            areaLabel: areaConfig?.label,
            intentionTitle: intention?.title,
            personaPrompt: activePersona?.prompt,
            memorySummary,
            feedbackGuidance,
        }),
        [
            activePersona?.prompt,
            areaConfig?.label,
            checkInType,
            feedbackGuidance,
            intention?.title,
            memorySummary,
        ]
    );

    const initialPrompt = useMemo(() => {
        if (draftIdParam || draftCheckInId || isFeedbackLoading || isPersonasLoading) {
            return undefined;
        }
        return {
            systemPrompt,
            triggerText: '[Start intention check-in]',
        };
    }, [draftCheckInId, draftIdParam, isFeedbackLoading, isPersonasLoading, systemPrompt]);

    const {
        messages,
        streamingMessage,
        isLoading,
        handleSendMessage,
        clearError,
        handleNewChat,
        initializeMessages,
        scrollToBottom,
        handleScroll,
    } = useChatOrchestration({
        scrollViewRef,
        inputRef,
        mode: 'intention',
        conversationId,
        initialPrompt,
    });

    const { handleThumb, feedbackModalProps } = useIntentionFeedbackModal({
        conversationId,
        feedbackByMessageId,
        messages,
        saveFeedback,
        personaId: activePersona?.id,
    });

    const personaSettings = usePersonaSettingsActions({
        activePersona,
        closePersonaSheet: () => setPersonaSheetOpen(false),
        remove,
    });

    useEffect(() => {
        let isActive = true;
        const loadDraft = async () => {
            if (!draftIdParam) return;
            const draft = await getCheckIn(draftIdParam);
            if (!isActive || !draft) return;
            setDraftCheckInId(draft.id);
            setDraftUpdatedAt(draft.updatedAt);
            if (draft.personaId) {
                await setActive(draft.personaId);
            }
            if (draft.messages && draft.messages.length > 0) {
                initializeMessages(draft.messages);
            }
        };
        loadDraft();
        return () => {
            isActive = false;
        };
    }, [draftIdParam, initializeMessages, setActive]);

    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingMessage, scrollToBottom]);

    const handleClose = useCallback(async () => {
        const hasDraftContent = hasContent(messages) || inputValue.trim().length > 0;
        if (hasDraftContent) {
            const draftMessages = [...messages];
            if (inputValue.trim()) {
                draftMessages.push({
                    id: Date.now().toString(),
                    role: 'user',
                    content: inputValue.trim(),
                    timestamp: Date.now(),
                });
            }

            if (draftCheckInId) {
                await updateCheckIn(draftCheckInId, {
                    messages: draftMessages,
                    status: 'draft',
                    summary: buildSummary(draftMessages),
                    title: buildSummary(draftMessages),
                });
            } else {
                const draft = await createCheckIn({
                    intentionId,
                    type: checkInType,
                    title: buildSummary(draftMessages),
                    summary: buildSummary(draftMessages),
                    mood: 'Reflective',
                    personaId: activePersona?.id,
                    messages: draftMessages,
                    status: 'draft',
                });
                setDraftCheckInId(draft.id);
            }
        }

        handleNewChat();
        router.replace('/(tabs)/today');
    }, [
        activePersona?.id,
        checkInType,
        draftCheckInId,
        handleNewChat,
        inputValue,
        intentionId,
        messages,
        router,
    ]);

    const handleFinish = useCallback(async () => {
        if (!hasContent(messages) && !inputValue.trim()) {
            return;
        }

        const finalMessages = [...messages];
        if (inputValue.trim()) {
            finalMessages.push({
                id: Date.now().toString(),
                role: 'user',
                content: inputValue.trim(),
                timestamp: Date.now(),
            });
        }

        const summary = buildSummary(finalMessages);
        const title = buildSummary(finalMessages);
        let resolvedIntention = intention;

        if (!intentionId && checkInType === 'intention') {
            resolvedIntention = await createIntention({
                title,
                description: summary,
                area: (areaParam ?? 'wellbeing') as IntentionArea,
            });
        }

        if (draftCheckInId) {
            await updateCheckIn(draftCheckInId, {
                messages: finalMessages,
                status: 'completed',
                summary,
                title,
                personaId: activePersona?.id,
            });
        } else {
            await createCheckIn({
                intentionId: resolvedIntention?.id,
                type: checkInType,
                title,
                summary,
                mood: 'Reflective',
                personaId: activePersona?.id,
                messages: finalMessages,
                status: 'completed',
            });
        }

        if (resolvedIntention && checkInType === 'intention') {
            await markIntentionGoalComplete(
                resolvedIntention.title,
                getLocalDateKey(new Date()),
                resolvedIntention.id
            );
        }

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
        createIntention,
        draftCheckInId,
        handleNewChat,
        inputValue,
        intention,
        intentionId,
        messages,
        router,
    ]);

    const handleSuggest = useCallback(async () => {
        if (!inputValue.trim() || isLoading) {
            return;
        }
        const text = inputValue.trim();
        setInputValue('');
        clearError();
        await handleSendMessage(text);
    }, [clearError, handleSendMessage, inputValue, isLoading]);

    const handlePlay = (text: string) => {
        if (isMuted) return;
        Speech.speak(text);
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
    };

    const handleShare = async (text: string) => {
        await Share.share({ message: text });
    };

    const headerDate = useMemo(() => {
        const baseDate = draftUpdatedAt ? new Date(draftUpdatedAt) : new Date();
        return baseDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
        });
    }, [draftUpdatedAt]);

    const handleToggleMuted = () => {
        setIsMuted((prev) => {
            const next = !prev;
            if (next) {
                Speech.stop();
            }
            return next;
        });
    };

    return (
        <SafeAreaView className="flex-1 bg-background-light dark:bg-background-dark" edges={['top']}>
            <View className="flex-1 max-w-md mx-auto w-full bg-background-light dark:bg-background-dark">
                <IntentionChatHeader
                    personaName={activePersona?.name ?? 'Rosebud'}
                    onOpenPersona={() => setPersonaSheetOpen(true)}
                    onOpenDrafts={() => router.push('/drafts')}
                    onClose={personaSheetOpen ? () => setPersonaSheetOpen(false) : handleClose}
                />

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
                    onVoicePress={() => Alert.alert('Voice input', 'Voice input is coming soon.')}
                    onImagePress={() => Alert.alert('Add image', 'Image upload is coming soon.')}
                    onFinish={handleFinish}
                    onSuggest={handleSuggest}
                />

                <PersonaSheet
                    visible={personaSheetOpen}
                    personas={personas}
                    activePersonaId={activePersona?.id}
                    activePersona={activePersona}
                    onClose={() => setPersonaSheetOpen(false)}
                    onSelectPersona={async (persona) => {
                        await setActive(persona.id);
                        setPersonaSheetOpen(false);
                    }}
                    onCreatePersona={() => {
                        setPersonaSheetOpen(false);
                        router.push('/persona/new');
                    }}
                    onOpenSettings={personaSettings.openSettings}
                />
                <PersonaSettingsSheet
                    visible={personaSettings.settingsOpen}
                    persona={personaSettings.settingsPersona}
                    onClose={personaSettings.closeSettings}
                    onEdit={personaSettings.editPersona}
                    onAdvanced={personaSettings.openAdvanced}
                    onDelete={personaSettings.deletePersona}
                />
                <FeedbackCommentModal
                    {...feedbackModalProps}
                />
            </View>
        </SafeAreaView>
    );
}
