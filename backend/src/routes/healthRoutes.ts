import { Application, Request, Response } from 'express';
import { getAiConfig, validateConfig } from '../config/ai';
import type { AiConfig } from '../config/ai';

interface ProfileSummary {
    name: string;
    model: string;
    valid: boolean;
}

function buildProfileSummary(config: AiConfig, name: string): ProfileSummary {
    const candidate: AiConfig = name === 'fast'
        ? { ...config, model: config.flashModel }
        : config;
    let valid = true;
    try {
        validateConfig(candidate);
    } catch {
        valid = false;
    }
    return { name, model: candidate.model, valid };
}

function buildHealthPayload(config: AiConfig): {
    status: 'ok';
    config: {
        valid: boolean;
        profiles: string[];
        defaultProfile: string;
    };
} {
    const profiles = ['default', 'fast'].map((name) => buildProfileSummary(config, name));
    const valid = profiles.every((profile) => profile.valid);
    return {
        status: 'ok',
        config: {
            valid,
            profiles: profiles.map((profile) => profile.name),
            defaultProfile: 'default',
        },
    };
}

export function registerHealthRoutes(app: Application): void {
    app.get('/health', (_req: Request, res: Response) => {
        try {
            const config = getAiConfig();
            res.json(buildHealthPayload(config));
        } catch (error) {
            res.status(503).json({
                status: 'unavailable',
                error: error instanceof Error ? error.message : 'Unknown AI config error.',
            });
        }
    });

    app.get('/ready', (_req: Request, res: Response) => {
        try {
            const config = getAiConfig();
            const profiles = ['default', 'fast'].map((name) => buildProfileSummary(config, name));
            const ready = profiles.some((profile) => profile.valid);
            if (ready) {
                res.json({ status: 'ready', profiles: profiles.map((profile) => profile.name) });
                return;
            }
            res.status(503).json({ status: 'not-ready', profiles: profiles.map((profile) => profile.name) });
        } catch (error) {
            res.status(503).json({
                status: 'not-ready',
                error: error instanceof Error ? error.message : 'Unknown AI config error.',
            });
        }
    });
}
