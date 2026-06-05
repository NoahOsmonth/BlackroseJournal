import { Application, Request, Response } from 'express';
import {
    handleEntryReflection,
    handleEntryTitle,
    handleStreakHaiku,
    handleWeeklyInsights,
    WeeklyInsightsEntry,
} from '../agent/insightsService';

function respondError(res: Response, status: number, code: string, message: string): void {
    res.status(status).json({ error: { code, message } });
}

function parseStringField(body: unknown, key: string): string | null {
    if (!body || typeof body !== 'object') return null;
    const value = (body as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
}

function parseEntryReflectionBody(body: unknown): { entryText: string } | null {
    const entryText = parseStringField(body, 'entryText');
    if (!entryText) return null;
    return { entryText };
}

function parseWeeklyInsightsBody(body: unknown): { entries: WeeklyInsightsEntry[] } | null {
    if (!body || typeof body !== 'object') return null;
    const rawEntries = (body as Record<string, unknown>).entries;
    if (!Array.isArray(rawEntries)) return null;
    const entries: WeeklyInsightsEntry[] = [];
    for (const raw of rawEntries) {
        if (!raw || typeof raw !== 'object') return null;
        const messages = (raw as { messages?: unknown }).messages;
        if (!Array.isArray(messages)) return null;
        const cleanMessages: { content: string }[] = [];
        for (const m of messages) {
            if (!m || typeof m !== 'object') return null;
            const content = (m as { content?: unknown }).content;
            if (typeof content !== 'string') return null;
            cleanMessages.push({ content });
        }
        entries.push({ messages: cleanMessages });
    }
    if (entries.length === 0) return null;
    return { entries };
}

function parseEntryTitleBody(body: unknown): { entryText: string } | null {
    const entryText = parseStringField(body, 'entryText');
    if (!entryText) return null;
    return { entryText };
}

function parseStreakHaikuBody(body: unknown): { entryText: string; streakCount: number } | null {
    const entryText = parseStringField(body, 'entryText');
    const rawStreak = body && typeof body === 'object' ? (body as Record<string, unknown>).streakCount : null;
    if (!entryText || typeof rawStreak !== 'number' || !Number.isFinite(rawStreak)) return null;
    return { entryText, streakCount: rawStreak };
}

export function registerInsightsRoutes(app: Application): void {
    app.post('/v1/insights/reflect', async (req: Request, res: Response) => {
        const request = parseEntryReflectionBody(req.body);
        if (!request) {
            respondError(res, 400, 'INVALID_REQUEST', 'Invalid reflection payload.');
            return;
        }
        try {
            const data = await handleEntryReflection(request);
            res.json({ data });
        } catch (error) {
            console.error('Entry reflection error:', error);
            respondError(res, 500, 'REFLECTION_ERROR', 'Failed to generate entry reflection.');
        }
    });

    app.post('/v1/insights/weekly', async (req: Request, res: Response) => {
        const request = parseWeeklyInsightsBody(req.body);
        if (!request) {
            respondError(res, 400, 'INVALID_REQUEST', 'Invalid weekly insights payload.');
            return;
        }
        try {
            const data = await handleWeeklyInsights(request.entries);
            res.json({ data });
        } catch (error) {
            console.error('Weekly insights error:', error);
            respondError(res, 500, 'WEEKLY_INSIGHTS_ERROR', 'Failed to generate weekly insights.');
        }
    });

    app.post('/v1/insights/title', async (req: Request, res: Response) => {
        const request = parseEntryTitleBody(req.body);
        if (!request) {
            respondError(res, 400, 'INVALID_REQUEST', 'Invalid title payload.');
            return;
        }
        try {
            const data = await handleEntryTitle(request);
            res.json({ data });
        } catch (error) {
            console.error('Entry title error:', error);
            respondError(res, 500, 'TITLE_ERROR', 'Failed to generate entry title.');
        }
    });

    app.post('/v1/insights/haiku', async (req: Request, res: Response) => {
        const request = parseStreakHaikuBody(req.body);
        if (!request) {
            respondError(res, 400, 'INVALID_REQUEST', 'Invalid haiku payload.');
            return;
        }
        try {
            const data = await handleStreakHaiku(request);
            res.json({ data });
        } catch (error) {
            console.error('Streak haiku error:', error);
            respondError(res, 500, 'HAIKU_ERROR', 'Failed to generate streak haiku.');
        }
    });
}
