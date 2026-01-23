# JournalApp Backend Agent

This backend hosts the MCP-aware chat agent (Node/Express). Railway should deploy **only** this folder.

## Setup

```bash
cd backend
npm install
npm run dev
```

## Environment

Create `.env` in `backend/` (Railway vars map 1:1):

- `PORT=8787`
- `ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081`
- `AGENT_API_KEY=` (optional; if set, client must send `Authorization: Bearer ...`)

### Model (LLM)
- `NANO_GPT_API_KEY=`
- `NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1`
- `NANO_GPT_MODEL=zai-org/glm-4.7-original:thinking`
- `NANO_GPT_FLASH_MODEL=zai-org/glm-4.7-flash-original`

### MCP (Supermemory)
- `MCP_SUPERMEMORY_URL=https://mcp.supermemory.ai/mcp`
- `MCP_SUPERMEMORY_API_KEY=`
- `MCP_SUPERMEMORY_PROJECT=` (optional, sent as `x-sm-project`)
- `MCP_DEFAULT_MEMORY_SERVER_ID=supermemory`
- `MCP_ALLOWLIST=supermemory`
> Supermemory MCP is enabled when `MCP_SUPERMEMORY_API_KEY` (or an explicit `MCP_SUPERMEMORY_URL`) is set.

### MCP (Advanced)
Provide additional servers as JSON:

```json
[
  {
    "id": "local-files",
    "name": "Local Files",
    "transport": "stdio",
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-filesystem"],
    "env": { "FILESYSTEM_ROOT": "/data" }
  }
]
```

Set:
- `MCP_SERVERS_JSON=[...]`

## Scripts

- `npm run dev` - watch mode
- `npm run build` - compile
- `npm start` - start compiled server
- `npm test` - run backend unit tests
