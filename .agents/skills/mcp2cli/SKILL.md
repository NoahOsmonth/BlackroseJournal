---
name: mcp2cli
description: Drive any MCP server (search, docs, filesystem, memory, games, DBs), OpenAPI spec, or GraphQL endpoint from the command line with zero codegen via mcp2cli. Use whenever the user wants to call MCP tools, hit REST/OpenAPI or GraphQL APIs, get library docs (Context7), do web search (Exa), wrap a tool as a CLI, or generate a skill from an API. Covers discovery, connect, execute, sessions, baking, auth, and per-server gotchas.
---

# mcp2cli — turn MCP / OpenAPI / GraphQL into a CLI

`mcp2cli` connects to an **MCP server**, an **OpenAPI spec**, or a **GraphQL endpoint** and turns its tools/endpoints into plain CLI subcommands at runtime. No codegen, no wrapper code to maintain.

It is an **MCP *client*** — it does not host a server. Every run either spawns a stdio server (`--mcp-stdio`), talks to a running HTTP/SSE server (`--mcp URL`), or reads a spec (`--spec`) / endpoint (`--graphql`).

## Install

```bash
uvx mcp2cli --help        # run directly, no install required
pip install mcp2cli       # or install it
```

## Core workflow (any backend)

1. **Connect** to a source.
2. **Discover** its commands with `--list` (or `--search <pat>`).
3. **Inspect** a command with `<command> --help` to resolve its real parameters.
4. **Execute** the command with flags, using `--pretty` / `--json` / `--head N` to shape output.

```bash
# MCP over HTTP/SSE
mcp2cli --mcp https://mcp.example.com/sse --list
mcp2cli --mcp https://mcp.example.com/sse create-task --title "Ship it"

# MCP over stdio (spawns the server as a subprocess)
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-filesystem /tmp" --list
mcp2cli --mcp-stdio "npx @modelcontextprotocol/server-filesystem /tmp" read-file --path /tmp/hello.txt

# OpenAPI spec (remote or local, JSON or YAML)
mcp2cli --spec https://petstore3.swagger.io/api/v3/openapi.json --list
mcp2cli --spec ./openapi.json list-pets --status available
mcp2cli --spec ./openapi.json create-pet --stdin <<<'{"name":"milo"}'

# GraphQL endpoint
mcp2cli --graphql https://api.example.com/graphql --list
mcp2cli --graphql https://api.example.com/graphql users --limit 10
```

### Real-world servers (examples)

Get up-to-date library/API docs (**Context7**) or web search (**Exa**) through mcp2cli:

```bash
# Context7: up-to-date, version-specific docs for any library/framework
mcp2cli --mcp-stdio "npx -y @upstash/context7-mcp" --list            # e.g. tools like context7_get_library_docs
# hosted variant (no npx): Authorization header + https://mcp.context7.com/mcp

# Exa: web search + page fetch
mcp2cli --mcp-stdio "npx -y exa-mcp-server" --env EXA_API_KEY=env:EXA_API_KEY --list   # web_search_exa, web_fetch_exa
# remote alternative, no local package: --mcp https://mcp.exa.ai/mcp
```

Use `--search` to confirm what a server actually exposes before assuming tool names.

## Connect-type quick reference

| Source | Flag | Notes |
|---|---|---|
| MCP over HTTP | `--mcp URL` | SSE or streamable HTTP. Use `--transport sse\|streamable\|auto`. |
| MCP over stdio | `--mcp-stdio "CMD ARGS"` | Spawns the server subprocess per run (see *stdio gotchas*). |
| OpenAPI | `--spec URL\|FILE` | Local files never cached; remote specs cached (~1h). |
| GraphQL | `--graphql URL` | Use `--fields` to pick a selection set. |

Sources are mutually exclusive — pick exactly one per run.

## Global options (order matters!)

Global options go **before** the subcommand. `mcp2cli --pretty list-clients` works; `mcp2cli list-clients --pretty` throws `unrecognized arguments`.

```bash
mcp2cli --json --head 5 --mcp https://... tool-name --arg value
```

Key globals: `--list`, `--search`, `--pretty`, `--json`, `--raw`, `--toon`, `--head N`, `--refresh`, `--cache-ttl`, `--auth-header`, `--env`, `--transport`, `--session*`, `--base-url`.

## Secrets & auth

- **Never put literal secrets in flags.** Use `env:` or `file:` prefixes so credentials stay out of the process list and shell history.
  ```bash
  mcp2cli --mcp https://mcp.example.com/sse \
    --auth-header "Authorization:env:TOKEN" list-thing
  mcp2cli --spec ./spec.json --auth-header "x-api-key:file:/run/secrets/key" do-thing
  ```
- **OAuth** (HTTP/SSE MCP only): `--oauth` (+ client id/secret via `env:`), PKCE auto, browser popup; tokens cached in `~/.cache/mcp2cli/oauth/`.
  ```bash
  mcp2cli --mcp https://... --oauth --oauth-client-id env:ID --oauth-client-secret env:SECRET --list
  ```

## Caching

- Remote specs and MCP tool-lists are cached in `~/.cache/mcp2cli/` (1h TTL). `--refresh` forces a re-fetch; `--cache-ttl N` tunes.
- Local `--spec` files are **never** cached — always current.
- If a server's schema changed but `--list` looks stale, pass `--refresh`.

## Tokens & large responses

- `--toon` (Token-Oriented Object Notation), **~40-60% fewer tokens** on large uniform arrays. Best for LLM consumption.
- `--head N` slices array results to the first `N`. Right tool for oversized/geo/exotic fields.
- Combine: `mcp2cli ... tool --head 3 --pretty` — preview before dumping a whole response.
- `--json` forces the full result envelope (incl. `structuredContent`, `isError`) — reliable for scripting, beats parsing the pretty banner.

## Sessions — one long-lived server for many calls

Every `--mcp-stdio` run spawns a fresh subprocess, pays startup cost, then exits. Sessions background the server once and route calls through it.

```bash
mcp2cli --mcp-stdio "npx some-server" --session-start myserver
mcp2cli --session myserver --list
mcp2cli --session myserver some-tool --flag x
mcp2cli --session-list          # PIDs + alive/dead
mcp2cli --session-stop myserver
```

**Platform caveat (verify on your OS):** sessions expose the server over an **Unix domain socket**. On **Windows** the daemon can be unreliable / does not survive the session owner; a fresh stdio spawn per call is the portable fallback. On macOS/Linux sessions are the recommended hot-path optimization.

## Bake — save a connection once, reuse forever

```bash
mcp2cli bake create myapi --mcp-stdio "npx some-server" --exclude "delete-*"
mcp2cli @myapi --list                    # run with @NAME
mcp2cli bake list / show myapi / update myapi / remove myapi
mcp2cli bake install myapi               # ~/.local/bin/myapi wrapper
```

`bake show` masks secrets. Config lives in `~/.config/mcp2cli/baked.json` (override `MCP2CLI_CONFIG_DIR`). Filters: `--include` (glob whitelist), `--exclude` (glob blacklist), `--methods` (HTTP, OpenAPI).

## Adding an MCP server to a client config JSON (`mcpServers`)

mcp2cli **does not generate client-config JSON.** `bake install` only writes a
`~/.local/bin` shell wrapper — it does **not** register the server with any MCP
client. To make a server available to an app/agent (Codex, Claude, Cursor,
Windsurf, custom agent, your own app), write the standard `mcpServers` block
into that client's config JSON yourself.

### stdio server (spawned per client launch)

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    },
    "exa": {
      "command": "npx",
      "args": ["-y", "exa-mcp-server"],
      "env": { "EXA_API_KEY": "your_key_here" }
    }
  }
}
```

### remote / HTTP server (long-lived, no per-client spawn)

```json
{
  "mcpServers": {
    "exa": { "url": "https://mcp.exa.ai/mcp" },
    "context7": { "url": "https://mcp.context7.com/mcp" }
  }
}
```

### remote server with auth header

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "headers": { "Authorization": "Bearer your_key_here" }
    }
  }
}
```

### where these blocks go

- **Repo/project scope:** `.mcp.json` (root of the repo) or `<client>/.mcp.json`.
- **User/client scope:** `.claude`, `claude_desktop_config.json`, Cursor
  `.cursor/mcp.json`, Windsurf `~/.codeium/windsurf/mcp_config.json`, Gemini
  `~/.gemini/settings.json`, etc. Check the specific client's docs.
- Honor the exact key (`url` vs `serverUrl` vs `httpUrl`) per client — shown in
  the server's own install docs; the `mcpServers` wrapper shape is the shared core.

> Tip: use mcp2cli to *test* a server first (it's your fastest validation loop),
> then write it into a client config once the command is proven. For a stdio
> server fed through mcp2cli, remember its `--root PATH|FILE_URI` exposes
> filesystem roots to the server via `roots/list`.

## Remote HTTP transport (pick the right one)

```bash
# Default tries streamable HTTP, then SSE
mcp2cli --mcp https://mcp.example.com/sse --list
# Force a transport explicitly
mcp2cli --mcp https://mcp.example.com/sse --transport sse --list
mcp2cli --mcp https://mcp.example.com/sse --transport streamable --list
```

Prefer **remote HTTP/SSE when the server is already long-running** (no per-call spawn, survives the caller going away). Prefer **stdio when the server is ephemeral** or you need its exact local runtime.

## Generic anti-patterns (apply to every backend)

- Assume nothing from memory — run `--list`/`<tool> --help` first; backend tool names drift.
- Test before you bake: large responses (`--head 3`), date formats, pagination, binary/non-JSON returns, error messages on invalid args.
- Scoping: if a result contains more than the expected domain (cross-org records, extra tenants), stop and re-scope — don't act on over-broad data.
- A remote/tool that exists may still reject at runtime (auth, quota, validation). `pcall`-equivalent: check `isError` in `--json` output, not just exit code.
- **stdout vs banner:** some servers emit a banner/log line before tool output. Parse the tail, filter the banner, or use `--json`.

## Generating a skill from an API

The workflow below turns any discovered tool surface into a portable `SKILL.md` so another agent can use it cleanly:

1. `mcp2cli --mcp URL --list` — discover all commands.
2. `<command> --help` each interesting command; probe edge/error cases (oversized responses, date formats, pagination, binary).
3. `mcp2cli bake create myapi --mcp-stdio "..." [--exclude ...]` — save the connection.
4. `mcp2cli bake install myapi --dir <skill>/scripts/` — drop a wrapper into the skill.
5. Author `SKILL.md` with:

```yaml
---
name: myapi
description: Interact with the MyAPI service
allowed-tools: Bash(bash *)
---
```

- **Knowledge Delta Principle:** do *not* re-list every `--help` flag. Document what actually matters in practice: the surprisingly-default behaviors, param combinations that break, rate limits, oversized fields, and every gotcha you hit while probing.

## References

- [`references/connection-recipes.md`](references/connection-recipes.md) — stdio/HTTP/session/bake deep-dives, platform gotchas, and the connect-vs-serve decision.
- [`references/mcp-servers.md`](references/mcp-servers.md) — curated useful MCP servers (search, docs, web, filesystem, memory) with exact connect commands.