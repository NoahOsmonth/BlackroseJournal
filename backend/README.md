# JournalApp Optional Local Backend

The app now talks to NanoGPT directly from the phone. This backend is kept as
an optional local development harness for route/provider testing only.

## Setup

```bash
cd backend
npm install
npm run dev
```

## Environment

Create `.env` in `backend/`:

- `PORT=8787`
- `ALLOWED_ORIGINS=http://localhost:19006,http://localhost:8081`
- `AGENT_API_KEY=` (optional; if set, client must send `Authorization: Bearer ...`)

### Model (LLM)
- `NANO_GPT_API_KEY=`
- `NANO_GPT_API_BASE_URL=https://nano-gpt.com/api/v1`
- `NANO_GPT_MODEL=moonshotai/kimi-k2.5:thinking`
- `NANO_GPT_FLASH_MODEL=moonshotai/kimi-k2.5`

## Scripts

- `npm run dev` - watch mode
- `npm run build` - compile
- `npm start` - start compiled server
