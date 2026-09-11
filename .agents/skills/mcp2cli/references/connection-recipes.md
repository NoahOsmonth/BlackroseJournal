# mcp2cli connection recipes & gotchas

Deep-dive on the connection mechanics behind `SKILL.md`. Where a behavior is
platform-specific, that is flagged explicitly — do not assume cross-OS parity.

## Choose: connect-to-server vs. host-a-server

- mcp2cli is a **client**. It connects to an MCP server; it never hosts one.
- To have something "always online," make the **server** long-running (e.g. a
  background daemon / OS service on boot), then point mcp2cli `--mcp URL` at it.
- `--session` keeps an stdio server alive for the duration of the daemon, but
  that is a per-host socket, not a boot service (see sessions).

## stdio transport

```bash
mcp2cli --mcp-stdio "node /abs/path/server.mjs" --list
mcp2cli --mcp-stdio "npx -y @upstash/context7-mcp" --list
mcp2cli --mcp-stdio "npx -y exa-mcp-server" --env EXA_API_KEY=env:EXA_API_KEY web_search_exa --query "npcs"
```

Gotchas:

- **Windows path separator:** use **forward slashes**. Backslashes are eaten by
  the shell before mcp2cli tokenizes the stdio command
  (`C:\Users\me\app` -> `C:Usersmeapp`, `MODULE_NOT_FOUND`). Write
  `C:/Users/me/app/server.mjs`.
- **Out-of-band env:** pass with `--env KEY=value` (supports `env:` indirection).
- **Spawn cost:** every call spawns the subprocess. For bursts use a session
  (non-Windows) or a baked alias; for truly many calls, host the server over HTTP.
- **One-shot + exit:** the server's startup banner (if any) lands first — trim it
  or use `--json`. `pcall`-style: a clean exit code ≠ a successful tool call.

## HTTP / SSE / streamable transport

```bash
mcp2cli --mcp https://mcp.example.com/sse --list
mcp2cli --mcp https://mcp.example.com/sse --transport streamable tool --arg v
mcp2cli --mcp https://mcp.example.com/sse --auth-header "Authorization:env:TOKEN" --list
```

- Default order: try streamable HTTP, fall back to SSE. Force with `--transport`.
- Best when the server is already running as a long-lived process/service (no
  per-call spawn, and it survives the caller exiting).
- Use `--auth-header` with `env:` / `file:` secret indirection for anything remote.

## Sessions (daemonized stdio server)

```bash
mcp2cli --mcp-stdio "npx server" --session-start name
mcp2cli --session name tool --arg v
mcp2cli --session-list
mcp2cli --session-stop name
```

- **Mechanism:** a background daemon exposing the server over an **Unix domain
  socket**.
- **Windows caveat (verified-hostile):** the socket does not reliably survive on
  Windows, and the daemon is tied to the launching session, not to machine boot.
  On Windows, prefer a fresh stdio spawn per call, or host the server over HTTP
  and use `--mcp URL`.
- Sessions are **not** an autostart service. They only last as long as the daemon
  is alive.

## Bake (saved config / named alias)

```bash
mcp2cli bake create NAME --mcp-stdio "..." [--include 'x-*'] [--exclude 'delete-*'] [--methods GET,POST]
mcp2cli @NAME --list
mcp2cli bake list|show|update|remove|install NAME
```

- `bake show` masks secrets; store lives in `~/.config/mcp2cli/baked.json`
  (`MCP2CLI_CONFIG_DIR` overrides).
- Useful filters keep a noisy surface (delete/update ops) off the CLI.

## Output-shaping conventions

- `--pretty` readable JSON.
- `--json` full envelope (incl. `structuredContent`, `isError`) — best for
  scripting/logic.
- `--toon` compact token-oriented form for large uniform arrays (~40-60% less).
- `--head N` truncate arrays to first `N` (oversized/geo/exotic fields).
- Order: these globals go **before** the subcommand.