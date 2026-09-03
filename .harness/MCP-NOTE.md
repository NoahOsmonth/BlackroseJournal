# MCP wiring — intentionally disabled (known scaffold gotcha)

The metaharness scaffold generated these broken entries out of the box:

- `.opencode/opencode.json` → `npx blackrosejournal-harness@latest mcp start`
- `optional-mcps/blackrosejournal-harness-hermes.json` → `npx -y blackrosejournal-harness-hermes@latest mcp start`

But the generated `bin/cli.js` has NO `mcp` subcommand (only `init` / `doctor` / `--version` / `--help`).
Wiring them as-is would fail at runtime, so this install deliberately omits/enables-off MCP:

- `opencode.json` ships with NO `mcp` block (model + permission only).
- `.hermes/optional-mcps/blackrosejournal-harness-hermes.json` ships with `"enabled": false`
  and a local-only command placeholder.

To re-enable later: implement `mcp start` in the harness CLI (list real tools),
then restore the `mcp` block pointing at the local path (never `@latest` from the network
without pinning), and flip `enabled` back on.
