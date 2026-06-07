import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AiFeedbackRecord,
    AiFeedbackScope,
    SaveAiFeedbackInput,
    buildFeedbackGuidance,
    listAiFeedback,
    saveAiFeedback,
} from '@/services/feedback/feedbackStorage';

interface UseAiFeedbackOptions {
    scope: AiFeedbackScope;
    personaId?: string;
    conversationId?: string;
}

interface UseAiFeedbackReturn {
    feedbackByMessageId: Record<string, AiFeedbackRecord>;
    guidance?: string;
    isLoading: boolean;
    save: (input: Omit<SaveAiFeedbackInput, 'scope'>) => Promise<AiFeedbackRecord>;
}

function matchesContext(record: AiFeedbackRecord, options: UseAiFeedbackOptions): boolean {
    if (record.scope !== options.scope) return false;
    if (options.personaId && record.personaId && record.personaId !== options.personaId) {
        return false;
    }
    return true;
}

function toMessageMap(records: readonly AiFeedbackRecord[]): Record<string, AiFeedbackRecord> {
    return records.reduce<Record<string, AiFeedbackRecord>>((acc, record) => {
        acc[record.messageId] = record;
        return acc;
    }, {});
}

export function useAiFeedback(options: UseAiFeedbackOptions): UseAiFeedbackReturn {
    const [records, setRecords] = useState<AiFeedbackRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { scope, personaId, conversationId } = options;

    const refresh = useCallback(async () => {
        setIsLoading(true);
        const loaded = await listAiFeedback(scope);
        setRecords(loaded.filter((record) => matchesContext(record, {
            scope,
            personaId,
            conversationId,
        })));
        setIsLoading(false);
    }, [conversationId, personaId, scope]);

    useEffect(() => {
        refresh();
    }, [refresh]);

    const save = useCallback(async (input: Omit<SaveAiFeedbackInput, 'scope'>) => {
        const record = await saveAiFeedback({ ...input, scope });
        await refresh();
        return record;
    }, [refresh, scope]);

    return {
        feedbackByMessageId: useMemo(() => toMessageMap(records), [records]),
        guidance: useMemo(() => buildFeedbackGuidance(records), [records]),
        isLoading,
        save,
    };
}
