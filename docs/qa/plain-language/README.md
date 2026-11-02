# Plain-language pass — visual evidence

Issue #12: user-facing copy used implementation words ("provider", "API key",
"Base URL", "context window", "temperature", "Top-P", "atoms", "digests",
"Episodic", "Semantic", "Profile").

- **Before (baseline):** `55c8b9a` (`origin/main` at the time of the change).
- **After (changed):** branch `agent/plain-language-ui-be72638456c3`.
- **Scenario:** Expo web on this repo, viewport 390 × 844 CSS px, device scale
  factor 2, dark theme, same seeded on-device data for both runs.
- **Capture:** Playwright Chromium, routes `/settings`, `/explore`,
  `/memory-graph`; no text or state was mocked in the page.

| Scenario | Before | After |
|---|---|---|
| Settings overview | [before/settings-overview.png](before/settings-overview.png) | [after/settings-overview.png](after/settings-overview.png) |
| Settings → AI (open) | [before/settings-ai.png](before/settings-ai.png) | [after/settings-ai.png](after/settings-ai.png) |
| Settings → AI → Advanced | [before/settings-ai-advanced.png](before/settings-ai-advanced.png) | [after/settings-ai-advanced.png](after/settings-ai-advanced.png) |
| Settings → Writing style (open) | [before/settings-writing-style.png](before/settings-writing-style.png) | [after/settings-writing-style.png](after/settings-writing-style.png) |
| Settings → Your data (open) | [before/settings-data.png](before/settings-data.png) | [after/settings-data.png](after/settings-data.png) |
| Settings → Memory (open) | [before/settings-memory.png](before/settings-memory.png) | [after/settings-memory.png](after/settings-memory.png) |
| Memory hub — top | [before/memory-hub-top.png](before/memory-hub-top.png) | [after/memory-hub-top.png](after/memory-hub-top.png) |
| Memory hub — layer filters | [before/memory-hub-filters.png](before/memory-hub-filters.png) | [after/memory-hub-filters.png](after/memory-hub-filters.png) |
| Memory hub — map link | [before/memory-hub-map-link.png](before/memory-hub-map-link.png) | [after/memory-hub-map-link.png](after/memory-hub-map-link.png) |
| Memory map | [before/memory-map.png](before/memory-map.png) | [after/memory-map.png](after/memory-map.png) |

The chat model chip is not reachable in this empty, unconfigured state, so the
chat picker itself is covered by component tests
(`ChatModelPickerSheet`, `ModelHeaderControl`) rather than by this capture set.
The before/after pairs above cover every settings surface, the memory hub and
the memory map.
