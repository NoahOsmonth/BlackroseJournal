# JournalApp Backend Agent

This backend hosts the chat agent (Node/Express) with SimpleMem-based long-term memory.
Railway should deploy **only** this folder.

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
- `NANO_GPT_MODEL=moonshotai/kimi-k2.5:thinking`
- `NANO_GPT_FLASH_MODEL=moonshotai/kimi-k2.5`

### SimpleMem Long-Term Memory
- `SIMPLEMEM_ENABLED=true`
- `SIMPLEMEM_TABLE_NAME=journal_global_memory`
- `SIMPLEMEM_DB_PATH=./data/simplemem`
- `SIMPLEMEM_TOP_K=12`
- `SIMPLEMEM_EMBEDDING_MODEL=openai/text-embedding-3-small`
- `OPENROUTER_EMBEDDING_API_KEY=`
- `OPENROUTER_EMBEDDING_BASE_URL=https://openrouter.ai/api/v1`

The memory bridge uses:
- NanoGPT (`NANO_GPT_*`) for memory extraction/planning calls.
- OpenRouter embeddings for vector indexing/retrieval.

## Scripts

- `npm run dev` - watch mode
- `npm run build` - compile
- `npm start` - start compiled server
- `npm test` - run backend unit tests
