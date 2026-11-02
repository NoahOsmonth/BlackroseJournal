import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import { relPosix } from './mocks/repoPath';

/**
 * Rule 13 guard: the person using this app writes in it, not code for it.
 *
 * Scans JSX text, the UI attributes that carry visible copy, and the string
 * arguments of the notification helpers. It deliberately does NOT scan code
 * identifiers, storage keys, env vars or service APIs — those keep their
 * technical names.
 *
 * Shared label maps (`MEMORY_LAYER_LABELS`, `HUB_LAYER_LABELS`, tool labels)
 * are plain values rather than JSX, so their own component tests assert the
 * wording (`MemoryGraphComponents`, `MemoryHubScreen`, `toolUiMeta`).
 */

const ROOTS = ['app', 'components'];

/** Attributes whose string value a person can read. */
const UI_ATTRIBUTES = new Set([
    'label',
    'title',
    'hint',
    'detail',
    'description',
    'placeholder',
    'message',
    'accessibilityLabel',
    'summary',
    'emptyMessage',
    'subtitle',
    'confirmLabel',
    'cancelLabel',
]);

/** Helpers whose literal arguments reach the screen. */
const NOTIFY_CALLS = new Set(['notifyUser', 'webConfirm', 'alert']);

const BANNED_WORDS = [
    'provider',
    'providers',
    'api',
    'url',
    'urls',
    'endpoint',
    'endpoints',
    'token',
    'tokens',
    'context window',
    'ctx',
    'json',
    'model',
    'models',
    'atom',
    'atoms',
    'digest',
    'digests',
    'cache',
    'cached',
    'server',
    'servers',
    'sync',
    'llm',
    'embedding',
    'vector',
    'prompt',
    'prompts',
    'schema',
    'graph',
    'episodic',
    'semantic',
    'procedural',
    'session',
    'sessions',
    'temperature',
    'top-p',
    'sampling',
    'payload',
    'manifest',
    'shard',
    'config',
    'configure',
    'sse',
    'oauth',
    'webview',
    'fetch',
    'fetching',
    'repository',
    'repo',
    'runtime',
    'native',
    'hex',
    'args',
    'tool',
    'tools',
];

const BANNED_PATTERN = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

export interface Finding {
    readonly file: string;
    readonly line: number;
    readonly text: string;
    readonly word: string;
}

/** A URL example ("https://…") or a raw color code is a field example, not prose. */
function isFieldExample(text: string): boolean {
    return /:\/\//.test(text) || /^#[0-9a-f]{3,8}$/i.test(text.trim());
}

function literalText(node: ts.Node): string | null {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        return node.text;
    }
    if (ts.isTemplateExpression(node)) {
        let out = node.head.text;
        for (const span of node.templateSpans) out += '…' + span.literal.text;
        return out;
    }
    if (ts.isJsxExpression(node) && node.expression) {
        return literalText(node.expression);
    }
    return null;
}

function collect(
    node: ts.Node,
    source: ts.SourceFile,
    file: string,
    findings: Finding[],
): void {
    const check = (raw: string, at: ts.Node) => {
        const text = raw.replace(/\s+/g, ' ').trim();
        if (!text || isFieldExample(text)) return;
        const match = BANNED_PATTERN.exec(text);
        if (!match) return;
        findings.push({
            file,
            line: source.getLineAndCharacterOfPosition(at.getStart(source)).line + 1,
            text,
            word: match[1] ?? match[0],
        });
    };

    if (ts.isJsxText(node)) {
        check(node.text, node);
    } else if (
        ts.isJsxAttribute(node)
        && UI_ATTRIBUTES.has(node.name.getText(source))
        && node.initializer
    ) {
        const text = literalText(node.initializer);
        if (text) check(text, node);
    } else if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(source);
        const reachesScreen = NOTIFY_CALLS.has(callee)
            || callee.endsWith('.alert')
            || callee.endsWith('.confirm');
        if (reachesScreen) {
            for (const arg of node.arguments) {
                const text = literalText(arg);
                if (text) check(text, arg);
            }
        }
    }

    ts.forEachChild(node, (child) => collect(child, source, file, findings));
}

export function scanSource(source: string, fileName = 'fixture.tsx'): Finding[] {
    const sourceFile = ts.createSourceFile(
        fileName,
        source,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
    );
    const findings: Finding[] = [];
    collect(sourceFile, sourceFile, fileName, findings);
    return findings;
}

function collectFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return collectFiles(full);
        return entry.name.endsWith('.tsx') ? [full] : [];
    });
}

function scanRepo(): { findings: Finding[]; fileCount: number } {
    const findings: Finding[] = [];
    let fileCount = 0;
    for (const root of ROOTS) {
        const rootPath = path.join(process.cwd(), root);
        if (!fs.existsSync(rootPath)) continue;
        for (const file of collectFiles(rootPath)) {
            fileCount += 1;
            const source = fs.readFileSync(file, 'utf8');
            const sourceFile = ts.createSourceFile(
                file,
                source,
                ts.ScriptTarget.Latest,
                true,
                ts.ScriptKind.TSX,
            );
            const repoPath = relPosix(process.cwd(), file);
            collect(sourceFile, sourceFile, repoPath, findings);
        }
    }
    return { findings, fileCount };
}

describe('plain-language copy (AGENTS.md rule 13)', () => {
    it('catches technical words in JSX text, UI attributes and notices', () => {
        const findings = scanSource(`
            export function Demo() {
                return (
                    <View accessibilityLabel="API key">
                        <Text>Bring your own provider</Text>
                    </View>
                );
            }
            notifyUser('Model saved', 'Fetched from the endpoint.');
        `);
        expect(findings.map((finding) => finding.word.toLowerCase()).sort())
            .toEqual(['api', 'endpoint', 'model', 'provider']);
    });

    it('leaves code identifiers alone', () => {
        const findings = scanSource(`
            const provider = getProvider();
            const session = readSession();
            export function Demo() {
                return <Text>{provider} {session}</Text>;
            }
        `);
        expect(findings).toEqual([]);
    });

    it('keeps every user-facing string free of implementation words', () => {
        const { findings } = scanRepo();
        expect(findings).toEqual([]);
    });

    it('scans a meaningful part of the UI', () => {
        const { fileCount } = scanRepo();
        expect(fileCount).toBeGreaterThan(100);
    });
});
