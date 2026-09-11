# Useful general-purpose MCP servers (drive them with mcp2cli)

Curated, off-the-shelf MCP servers you can point mcp2cli at. **Verify with the
server's own `--list` before relying on tool names** — surfaces drift. Commands
below are current as of the last check; confirm API keys/pricing on the vendor
page.

## Search & research

### Exa — web search + page fetch
- Local npm (needs `EXA_API_KEY` from dashboard.exa.ai):
  ```bash
  mcp2cli --mcp-stdio "npx -y exa-mcp-server" --env EXA_API_KEY=env:EXA_API_KEY --list
  # tools (default): web_search_exa, web_fetch_exa
  # optional via tools param / hosted URL: web_search_advanced_exa, agent_run
  mcp2cli --mcp-stdio "npx -y exa-mcp-server" --env EXA_API_KEY=env:EXA_API_KEY web_search_exa --query "what changed in Next 15"
  ```
- Remote (no local package), optionally selecting tools:
  ```bash
  mcp2cli --mcp "https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa" --list
  ```
- Keys via header: `--auth-header "x-api-key:env:EXA_API_KEY"`.

### Context7 — up-to-date documentation for any library/framework
- Local npm:
  ```bash
  mcp2cli --mcp-stdio "npx -y @upstash/context7-mcp" --list
  # returns version-specific docs/code examples straight from source
  ```
- Hosted (pass key via Authorization header): `https://mcp.context7.com/mcp`
  (`--auth-header "Authorization:Bearer env:CONTEXT7_API_KEY"`). `npx ctx7 setup` can configure clients.
- Use it to resolve stale-doc / version drift questions for a dependency.

## General web / fetch / retrieval

- **fetch** (off-the-shelf): fetch a URL to text/markdown.
  `mcp2cli --mcp-stdio "npx -y @modelcontextprotocol/server-fetch" --list`
- **filesystem**: guarded FS access for read/write/test.
  `mcp2cli --mcp-stdio "npx -y @modelcontextprotocol/server-filesystem /tmp" --root /tmp --list`
- **memory / knowledge-graph**: persistent entity/relation store for long-running agents.
- **github / gitlab**: repo, issues, PR, search. (Credentials via `--env` / auth header.)

## Discover more servers

- Use the vendor docs or an MCP registry (e.g. registration directories,
  mcpservers.org listings) and **search** them the same way you'd search anything:
  decide the capability, find the server, `--list` its real tools, then bake.
- Prefer servers that can run **stdio locally** (no per-call HTTP auth churn) or
  provide a **remote URL** for long-lived use — whichever matches how you'll use it.

## Decision checklist before adopting a server

1. Transport: stdio (ephemeral) vs remote HTTP (long-running)? 
2. Auth: API key via `env:`/`file:`, or OAuth?
3. What does `--list` actually expose? Are the real tools the ones you expected?
4. Output size: does any tool return oversized fields (document dumps, base64)?
   Plan `--head N` / `--toon`.
5. Rate limits / quotas: casual vs production; where does the key come from?