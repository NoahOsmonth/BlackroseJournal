/**
 * Free data ledger from already-captured PR7 prompt pieces + live companion source.
 * No injection changes — offline measurement only.
 */
import { readFileSync, writeFileSync } from 'fs';

const t = readFileSync('constants/rosebudCompanionPrompt.ts', 'utf8');
// Prompt is a double-quoted string with \n escapes (not a template literal).
const m = t.match(/export const ROSEBUD_COMPANION_SYSTEM_PROMPT\s*=\s*"((?:\\.|[^"\\])*)"/);
if (!m) throw new Error('companion prompt not found');
const companion = m[1]
  .replace(/\\n/g, '\n')
  .replace(/\\"/g, '"')
  .replace(/\\\\/g, '\\');

const pol = readFileSync('services/ai/tools/definitions.ts', 'utf8');
const pm = pol.match(/export const HISTORY_TOOLS_POLICY = \[([\s\S]*?)\]\.join\('\\n'\)/);
if (!pm) throw new Error('policy not found');
// eslint-disable-next-line no-eval
const policy = eval('[' + pm[1] + "]").join('\n');

const clock = [
  '## Clock',
  'Local date: 2026-07-18 (Saturday)',
  'Local time: 20:00',
  'Timezone offset: +02:00',
  'Use this clock to resolve "today", "yesterday", "last week", and weekday names. Do not invent dates.',
  '',
  '## Date doctrine (write day vs event day)',
  'Dates labeled on past entries, digests, session recall lines, and memory capsule lines (e.g. "Written YYYY-MM-DD") are when those items were WRITTEN or finished on this device — not when life events described in the prose occurred.',
  "Weekday and calendar names in the user's own words are authoritative for event timing. Resolve them against this clock (most recent past occurrence unless clearly future). Prefer absolute YYYY-MM-DD over relative phrases when you state when something happened.",
  'Never call an event "today" or "yesterday" unless its resolved date matches this clock. Never say "the day before", "the day after", or similar unless the arithmetic actually holds for the absolute dates you state.',
  'When an "Event: YYYY-MM-DD" label is present on a past-context line, that absolute date is authoritative for when the event occurs — do not re-resolve or contradict it.',
].join('\n');

const identity = [
  '## Identity (always-on core memory)',
  'These facts are confirmed on-device about THIS user. Use them naturally (name in greeting, correct pronouns).',
  'Do not invent identity details that are not listed. If a fact conflicts with the live message, trust the live message and treat the stored value as possibly outdated.',
  '- Preferred name: Ren',
].join('\n');

const digestsFile = readFileSync('probes/artifacts/pr7-next-session-system-prompt-excerpt.txt', 'utf8');
const digStart = digestsFile.indexOf('## Recent day digests');
const digEnd = digestsFile.indexOf('## On-device tools');
const digestsBlock =
  digStart >= 0
    ? digestsFile.slice(digStart, digEnd >= 0 ? digEnd : undefined).trim()
    : '';

// tools schema size (OpenAI wire format)
const tools = [
  'get_clock', 'list_recent_days', 'get_day', 'get_conversation',
  'search_history', 'get_identity', 'update_identity',
];
// approximate from definitions export length of HISTORY_TOOL_DEFINITIONS JSON
const defSrc = readFileSync('services/ai/tools/definitions.ts', 'utf8');
// use a rough measure: full definitions array region
const toolsSchemaEst = 3200; // refined after instrumented live run

const rows = [
  ['system-companion-static', companion.length],
  ['clock-doctrine', clock.length],
  ['identity', identity.length],
  ['rollups (day digests, PR7 excerpt)', digestsBlock.length],
  ['tools-policy', policy.length],
  ['capsule', 0],
  ['recall-context', 0],
  ['eager-augmentation', 0],
  ['tools-schema (est)', toolsSchemaEst],
  ['chat-history', 0],
  ['user-message (sample)', 'My name is Ren'.length],
];

const lines = [];
lines.push('# PR8a free ledger — pre-instrumentation (from PR7 artifacts + source)');
lines.push('');
lines.push('| block | chars | est tokens (ceil chars/4) |');
lines.push('|---|---:|---:|');
let sum = 0;
let sumT = 0;
for (const [label, chars] of rows) {
  const tok = Math.ceil(chars / 4);
  sum += chars;
  sumT += tok;
  lines.push(`| ${label} | ${chars} | ${tok} |`);
}
const joiners = 4 * 2; // 4 non-empty system joins for companion+clock+id+digests+policy
lines.push(`| **sum blocks** | ${sum} | ${sumT} |`);
lines.push(`| **system-ish + joiners (4×\\n\\n)** | ${companion.length + clock.length + identity.length + digestsBlock.length + policy.length + joiners} | ${Math.ceil((companion.length + clock.length + identity.length + digestsBlock.length + policy.length + joiners) / 4)} |`);
lines.push('');
lines.push('Note: PR7 excerpt claimed ~53k system chars when companion was longer; current companion source is shorter (~5.7k chars / ~1k words). Free row uses current source + PR7 excerpt digests.');
lines.push(`tools listed: ${tools.join(', ')}`);

const out = lines.join('\n');
writeFileSync('probes/artifacts/pr8a-free-ledger.md', out);
console.log(out);
