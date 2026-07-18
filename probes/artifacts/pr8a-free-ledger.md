# PR8a free ledger — pre-instrumentation (from PR7 artifacts + source)

| block | chars | est tokens (ceil chars/4) |
|---|---:|---:|
| system-companion-static | 47600 | 11900 |
| clock-doctrine | 1105 | 277 |
| identity | 334 | 84 |
| rollups (day digests, PR7 excerpt) | 559 | 140 |
| tools-policy | 1889 | 473 |
| capsule | 0 | 0 |
| recall-context | 0 | 0 |
| eager-augmentation | 0 | 0 |
| tools-schema (est) | 3200 | 800 |
| chat-history | 0 | 0 |
| user-message (sample) | 14 | 4 |
| **sum blocks** | 54701 | 13678 |
| **system-ish + joiners (4×\n\n)** | 51495 | 12874 |

Note: Companion static alone is ~47.6k chars (~11.9k est tokens). System-ish sum + joiners ≈ 51.5k — matches the live PR7/PR8a capture (~52.9k with digests/capsule variance). Free row uses current source + PR7 excerpt digests before instrumentation.
tools listed: get_clock, list_recent_days, get_day, get_conversation, search_history, get_identity, update_identity