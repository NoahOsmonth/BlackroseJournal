---
name: mcp2cli-bridge
description: Give Freebuff MCP server access by shelling out to mcp2cli. Use this skill whenever the user wants to connect MCP servers/tools, call an MCP tool, consume an OpenAPI/REST API, or query GraphQL from Freebuff. Freebuff has no native MCP client; mcp2cli is the shell bridge that turns any MCP server, OpenAPI spec, or GraphQL endpoint into plain CLI commands you run with the Bash tool. Triggers include "add MCP", "connect MCP server", "call this MCP tool", "list tools from <server>", "use this OpenAPI API", "graphql", and any request to use an external tool/API the user configures.
---

# Freebuff × MCP — via mcp2cli

Freebuff (formerly Manicode) does **not** have a native MCP client. Instead it
has full **shell execution**: run any CLI with the Bash tool. `mcp2cli` converts
an MCP server (or an OpenAPI spec / GraphQL endpoint) into a set of CLI commands,
so you reach MCP servers through Bash — no plugin required.

**Key idea:** MCP servers become shell commands. Discover with `--list`, run
with the generated subcommand.

## 1. Prerequisites

Freebuff needs both `uv` (or Python) and `mcp2cli` available on PATH.

Check once, install if missing (via the Bash tool):

```bash
command -v mcp2cli && mcp2cli --version || uv tool install mcp2cli
command -v uv || echo "uv missing — install: https://docs.astral.sh/uv/"
```

> Prefer `uv tool install mcp2cli` (isolated, upgrades cleanly). You can also
> run without installing via `uvx mcp2cli ...`.

## 2. Config file: `mcp_servers.json` (mcp-cli style) vs `--mcp-stdio`

mcp2cli takes sources as flags, so you can pass the server definition inline —
**no config file needed**:

```bash
# stdio MCP server (local, e.g. a filesystem server)
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-filesystem ." --list
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-filesystem ." read-file --path AGENTS.md

# HTTP/SSE MCP server (remote)
mcp2cli --mcp https://example.com/mcp --list
mcp2cli --mcp https://example.com/mcp create-task --title "Fix bug"

# OpenAPI REST API as CLI
mcp2cli --spec https://petstore3.swagger.io/api/v3/openapi.json --list

# GraphQL endpoint
mcp2cli --graphql https://api.example.com/graphql --list
```

## 3. Core workflow (always in this order)

1. **Imprint** — confirm `mcp2cli` is installed (step 1).
2. **Discover** — `... --list` to see every available tool/command. (Use
   `--search PATTERN` to filter without dumping everything.)
3. **Inspect** — `<command> --help` to see its flags/params before calling.
4. **Execute** — run the command with flags.
5. **Clean up** — if you started a session daemon, stop it when done.

```bash
# Discover
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-everything" --list

# Inspect one tool
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-everything" get-sum --help

# Execute
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-everything" get-sum --a 40 --b 2
# → The sum of 40 and 2 is 42.
```

## 4. Persistent sessions (reuse one live MCP connection)

Every plain invocation spawns a fresh MCP server process (slow for many calls).
For multi-step work, start a **named session daemon** once and route calls through it:

```bash
# Start once
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-filesystem ." --session-start repo-fs

# Reuse without restarting the server
mcp2cli --session repo-fs --list
mcp2cli --session repo-fs read-file --path AGENTS.md

# When done
mcp2cli --session-list          # check daemons (PID, alive/dead)
mcp2cli --session-stop repo-fs  # stop it
```

## 5. Auth / secrets — NEVER pass literal keys in commands

Freebuff runs your Bash commands verbatim, so a literal secret on the command
line lands in shell history and process listings. Always read secrets from env
or a file:

```bash
# Env var (recommended)
mcp2cli --mcp https://example.com/mcp \
  --auth-header "Authorization:env:MY_API_TOKEN" --list

# From file
mcp2cli --mcp https://example.com/mcp \
  --auth-header "x-api-key:file:/run/secrets/api_key" --list

# OAuth client credentials
mcp2cli --mcp https://example.com/mcp \
  --oauth-client-id env:CLIENT_ID --oauth-client-secret env:CLIENT_SECRET --list
```

## 6. Friendly output for the model

- `--pretty` → readable JSON.
- `--head N` → first N array records (huge responses).
- Pipe to `jq` to extract fields (`mcp2cli ... | jq '.items[].name'`).
- `--json` → force valid JSON envelopes.

## 7. Anti-patterns & gotchas (learned from testing)

- **Public "demo" MCP HTTP endpoints go stale.** `--mcp <url>` against dead
  public servers (stdlib.de, mcp.deepnote.com) returns 404. Prefer `--mcp-stdio`
  with a local server, or verify the remote URL hosts a real MCP endpoint first.
- **Tool names are renamed/aliased.** Don't guess the subcommand from docs —
  always `--list` to see what's actually exposed. (e.g. the everything-server
  calls its add tool `get-sum`, not `add`.)
- **stdio servers print startup banners to stdout.** You may see lines like
  `Starting default (STDIO) server...` before the real result; strip/disregard
  them when parsing.
- **Secrets in skill-created scripts:** if you `bake create` a saved config,
  `bake show` masks secrets, but the baked file lives in
  `~/.config/mcp2cli/baked.json` — treat it as sensitive.
- **Never put a secret in `AGENTS.md`/`CLAUDE.md`/skills.** Reference an env var
  or file, and let Freebuff read it from the environment at runtime.

## 8. Security

- External MCP servers / APIs return untrusted data — validate before acting.
- Only connect servers the user explicitly asks for or has configured.
- mcp2cli runs with the same permissions as your Bash tool. It is a bridge to
  whatever the server exposes; be deliberate about which tools you call.
- Stop background session daemons when a task is finished to avoid stray
  processes.