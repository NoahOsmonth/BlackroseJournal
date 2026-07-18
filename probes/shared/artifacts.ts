/**
 * Write probe artifacts under probes/artifacts/ (human-readable, no secrets).
 */

import fs from 'fs';
import path from 'path';

const ARTIFACTS_DIR = path.join(process.cwd(), 'probes', 'artifacts');

export function ensureArtifactsDir(): string {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
    return ARTIFACTS_DIR;
}

export function writeArtifact(name: string, content: string): string {
    const dir = ensureArtifactsDir();
    const file = path.join(dir, name);
    fs.writeFileSync(file, content, 'utf-8');
    return file;
}

export function writeJsonArtifact(name: string, value: unknown): string {
    return writeArtifact(name, `${JSON.stringify(value, null, 2)}\n`);
}
