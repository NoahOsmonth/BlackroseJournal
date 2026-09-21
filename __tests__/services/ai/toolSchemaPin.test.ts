/**
 * PR8c: tool schemas OTHER than list_recent_days stay byte-identical.
 * list_recent_days may gain optional order/from/to — nothing else may drift.
 *
 * Toolfix (2026-09): descriptions were DELIBERATELY rewritten (verb +
 * when-use + when-NOT-use + arg example) and the pin re-frozen below.
 * Explore (2026-09-19): `memory_list.kind` gained "note" because user-written
 * notes became first-class memory files. The enum is now derived from
 * `MEMORY_FILE_TYPES`, so this pin is what still catches a drift.
 * Parameters/required must still not drift without a matching pin update.
 */

import {
    HISTORY_TOOL_DEFINITIONS,
    toOpenAiToolSpecs,
} from '../../../services/ai/tools';

/** Frozen OpenAI tool specs for every history tool except list_recent_days. */
const PINNED_OTHER_TOOLS_JSON = JSON.stringify([
    {
        "type": "function",
        "function": {
            "name": "get_clock",
            "description": "Get the device local date and time. Use FIRST to resolve relative day phrases (\"yesterday\", \"last Friday\", \"tonight\") — never invent the date. Do not call it for timeless questions (\"what is grief?\"). No arguments.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_day",
            "description": "Get the digest for one calendar day: summary, topics, and session ids/titles. Use after list_recent_days when one day matters. Accepts YYYY-MM-DD, today, yesterday, or a weekday name. Do NOT use for full transcripts — pass an id from this digest to get_conversation. Example args: {\"date\":\"yesterday\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {
                        "type": "string",
                        "description": "Day reference: YYYY-MM-DD, today, yesterday, monday, last friday, etc."
                    }
                },
                "required": [
                    "date"
                ],
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_conversation",
            "description": "Load the full transcript for one past session (journal entry or intention check-in). Use ONLY when you need exact prior words — prefer get_day first to discover ids. Do NOT use to browse; it returns the whole session. Example args: {\"kind\":\"journal_entry\",\"id\":\"<id from a day digest>\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": [
                            "journal_entry",
                            "intention_checkin"
                        ],
                        "description": "Source kind."
                    },
                    "id": {
                        "type": "string",
                        "description": "Entry or check-in id from a day digest."
                    },
                    "date": {
                        "type": "string",
                        "description": "Optional day key if resolving by title instead of id."
                    },
                    "titleQuery": {
                        "type": "string",
                        "description": "Optional title substring to find a session on that day."
                    }
                },
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_history",
            "description": "Search day digests and local memory for a topic or keyword across days. Use for recurring themes (\"what do I keep writing about work?\"). Do NOT use for one known day (use get_day) or exact transcripts (use get_conversation). Example args: {\"query\":\"work stress\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search terms."
                    },
                    "from": {
                        "type": "string",
                        "description": "Start date YYYY-MM-DD inclusive."
                    },
                    "to": {
                        "type": "string",
                        "description": "End date YYYY-MM-DD inclusive."
                    },
                    "limit": {
                        "type": "number",
                        "description": "Max hits (default 6)."
                    }
                },
                "required": [
                    "query"
                ],
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "memory_search",
            "description": "Search OFFLINE file memories first (gated recall: route → thread shortlist → headers → bodies). Use for durable preferences, collaboration rules, or thread progress across sessions. Returns context + file refs; call memory_get for exact ids to verify. Example args: {\"query\":\"promotion plan feedback\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Question or topic to search in offline memory."
                    },
                    "limit": {
                        "type": "number",
                        "description": "Max files after manifest selection (default 5)."
                    }
                },
                "required": [
                    "query"
                ],
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "memory_list",
            "description": "Browse offline file memories by kind/query/thread (headers only, never bodies). Use to see what threads exist before searching. Example args: {\"kind\":\"project\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "kind": {
                        "type": "string",
                        "enum": [
                            "all",
                            "user",
                            "feedback",
                            "project",
                            "note"
                        ]
                    },
                    "query": {
                        "type": "string",
                        "description": "Optional search string."
                    },
                    "projectId": {
                        "type": "string",
                        "description": "Optional thread id filter."
                    },
                    "limit": {
                        "type": "number",
                        "description": "Max items (default 10)."
                    },
                    "offset": {
                        "type": "number",
                        "description": "Skip N items."
                    }
                },
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "memory_get",
            "description": "Load exact offline memory files by ids from memory_search or memory_list. Use ONLY with ids you already have — never guess ids. Example args: {\"ids\":[\"projects/work/Project/current-stage-abc.md\"]}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "ids": {
                        "type": "array",
                        "description": "One or more relative file ids from memory_search or memory_list.",
                        "items": {
                            "type": "string"
                        }
                    }
                },
                "required": [
                    "ids"
                ],
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "memory_overview",
            "description": "Offline memory status: formal thread counts, staged backlog, freshness. Use when the user asks about memory health or why something is not recalled yet.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "memory_flush",
            "description": "Stage recent finished sessions into offline memory now. Use when the user wants a just-finished conversation searchable immediately.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "memory_dream",
            "description": "Consolidate staged memories into formal threads (Dream). Use when the user wants memory cleanup or duplicate threads merged.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_identity",
            "description": "Read the on-device always-on identity profile (preferred name, pronouns, key people, durable facts). Use the injected Identity block when present; call this to re-check after an update. Do NOT call it to discover new facts about the user — ask them. No arguments.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_identity",
            "description": "Persist durable identity facts the user clearly stated (preferred name, pronouns, about, key people, hard facts). Use ONLY when the user explicitly stated a fact — never infer or invent. Secondary to automatic extraction. Example args: {\"preferredName\":\"Sam\",\"pronouns\":\"they/them\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "preferredName": {
                        "type": "string",
                        "description": "What the user wants to be called."
                    },
                    "name": {
                        "type": "string",
                        "description": "Alias for preferredName."
                    },
                    "pronouns": {
                        "type": "string",
                        "description": "e.g. she/her, he/him, they/them."
                    },
                    "about": {
                        "type": "string",
                        "description": "Short self-description (job, life stage)."
                    },
                    "keyPeople": {
                        "type": "array",
                        "description": "People in their life.",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {
                                    "type": "string"
                                },
                                "relation": {
                                    "type": "string"
                                }
                            }
                        }
                    },
                    "facts": {
                        "type": "array",
                        "description": "Durable preferences or facts as short strings.",
                        "items": {
                            "type": "string"
                        }
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why this update (for audit)."
                    }
                },
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_goals",
            "description": "List the user’s current goals and habits with status. Use before create_goal to avoid duplicates. Do NOT call it for journal-history questions. No arguments.",
            "parameters": {
                "type": "object",
                "properties": {},
                "additionalProperties": false
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_goal",
            "description": "Create a goal or habit ONLY when the user clearly asked to set/track one — never invent a goal the user did not state. Returns the created goal id. Example args: {\"title\":\"Run 3x a week\",\"type\":\"habit\"}.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Goal or habit title."
                    },
                    "type": {
                        "type": "string",
                        "enum": [
                            "goal",
                            "habit"
                        ],
                        "description": "goal (default) or habit."
                    },
                    "dateKey": {
                        "type": "string",
                        "description": "Optional start date YYYY-MM-DD (default today)."
                    }
                },
                "required": [
                    "title"
                ],
                "additionalProperties": false
            }
        }
    }
]);

describe('PR8c tool schema pin (other than list_recent_days)', () => {
    it('fourteen non-list_recent_days tools are byte-identical to the pin', () => {
        const others = toOpenAiToolSpecs(
            HISTORY_TOOL_DEFINITIONS.filter((d) => d.name !== 'list_recent_days')
        );
        expect(JSON.stringify(others)).toBe(PINNED_OTHER_TOOLS_JSON);
    });

    it('list_recent_days exposes optional order, from, to (backward compatible)', () => {
        const def = HISTORY_TOOL_DEFINITIONS.find((d) => d.name === 'list_recent_days');
        expect(def).toBeDefined();
        const props = def!.parameters.properties as Record<string, unknown>;
        expect(props.days).toBeDefined();
        expect(props.order).toEqual(
            expect.objectContaining({
                type: 'string',
                enum: ['newest', 'oldest'],
            })
        );
        expect(props.from).toEqual(expect.objectContaining({ type: 'string' }));
        expect(props.to).toEqual(expect.objectContaining({ type: 'string' }));
        // Still no required fields (all optional → old clients keep working).
        expect(def!.parameters.required).toBeUndefined();
    });

    it('registry still exposes exactly 15 history tools', () => {
        expect(HISTORY_TOOL_DEFINITIONS.map((d) => d.name)).toEqual([
            'get_clock',
            'list_recent_days',
            'get_day',
            'get_conversation',
            'search_history',
            'memory_search',
            'memory_list',
            'memory_get',
            'memory_overview',
            'memory_flush',
            'memory_dream',
            'get_identity',
            'update_identity',
            'list_goals',
            'create_goal',
        ]);
    });

    it('memory_search requires query and appears in OpenAI specs', () => {
        const def = HISTORY_TOOL_DEFINITIONS.find((d) => d.name === 'memory_search');
        expect(def).toBeDefined();
        expect(def!.parameters.required).toEqual(['query']);
        expect(def!.parameters.additionalProperties).toBe(false);
        const specs = toOpenAiToolSpecs();
        expect(specs.some((spec) => spec.function.name === 'memory_search')).toBe(true);
        expect(specs.find((spec) => spec.function.name === 'memory_search')!.function.parameters).toBe(
            def!.parameters
        );
    });

    it('no longer exposes the removed Hindsight recall tool', () => {
        expect(HISTORY_TOOL_DEFINITIONS.some((d) => d.name === 'recall_memory')).toBe(false);
    });
});
