const fs = require("fs");
const path = require("path");

// companion body
const t = fs.readFileSync("constants/rosebudCompanionPrompt.ts", "utf8");
const m = t.match(/export const ROSEBUD_COMPANION_SYSTEM_PROMPT = `([\s\S]*?)`;/);
const companion = m[1];
const est = (s) => Math.ceil((s || "").length / 4);

// tools policy
const def = fs.readFileSync("services/ai/tools/definitions.ts", "utf8");
const pm = def.match(/export const HISTORY_TOOLS_POLICY = \[([\s\S]*?)\]\.join\('\\n'\)/);
const policy = eval("[" + pm[1] + "]").join("\n");

// clock sample (fixed Saturday)
function pad(n){return n<10?"0"+n:""+n}
const now = new Date(2026,6,18,21,57,0);
const dateKey = "2026-07-18";
const weekday = "Saturday";
const time = "21:57";
const tz = "UTC+08:00";
const clock = [
  "## Clock",
  `Local date: ${dateKey} (${weekday})`,
  `Local time: ${time}`,
  `Timezone offset: ${tz}`,
  'Use this clock to resolve "today", "yesterday", "last week", and weekday names. Do not invent dates.',
  "",
  "## Date doctrine (write day vs event day)",
  'Dates labeled on past entries, digests, session recall lines, and memory capsule lines (e.g. "Written YYYY-MM-DD") are when those items were WRITTEN or finished on this device — not when life events described in the prose occurred.',
  "Weekday and calendar names in the user's own words are authoritative for event timing. Resolve them against this clock (most recent past occurrence unless clearly future). Prefer absolute YYYY-MM-DD over relative phrases when you state when something happened.",
  'Never call an event "today" or "yesterday" unless its resolved date matches this clock. Never say "the day before", "the day after", or similar unless the arithmetic actually holds for the absolute dates you state.',
  'When an "Event: YYYY-MM-DD" label is present on a past-context line, that absolute date is authoritative for when the event occurs — do not re-resolve or contradict it.',
].join("\n");

// identity empty vs with name
const idHeader = [
  "## Identity",
  "Confirmed on-device facts about THIS user. Use naturally (name, pronouns).",
  "Do not invent identity details that are not listed. If a fact conflicts with the live message, trust the live message and treat the stored value as possibly outdated.",
  "- Preferred name: Ren",
].join("\n");

// tools schema approx from live 886
const toolsSchemaEst = 886;

const persona = "## Persona Guidance\n" + "x".repeat(Math.max(0, 22*4-20)); // not accurate

console.log(JSON.stringify({
  companion: { chars: companion.length, est: est(companion) },
  clock: { chars: clock.length, est: est(clock) },
  identityWithName: { chars: idHeader.length, est: est(idHeader) },
  toolsPolicy: { chars: policy.length, est: est(policy) },
  toolsSchemaLiveEst: toolsSchemaEst,
}, null, 2));
console.log("---COMPANION---");
console.log(companion);
console.log("---POLICY---");
console.log(policy);
