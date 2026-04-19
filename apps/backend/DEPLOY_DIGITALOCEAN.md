# AI Backend Deployment (DigitalOcean App Platform)

This deploys only the AI backend in `apps/backend` (no Photon agent, no frontend).

## 1. Prereqs

- Repo connected to DigitalOcean App Platform
- Runtime secrets ready:
  - `K2_API_KEY` (required)
  - `ELEVENLABS_API_KEY` (optional, needed for `/jobs/agent-tts`)

## 2. App Spec

Use:

- `deploy/digitalocean/ai-backend-app.yaml`

Replace placeholder secret values (`REPLACE_ME*`) in DigitalOcean UI before launch.

## 3. Runtime Behavior

- Container: `apps/backend/Dockerfile`
- Health endpoint: `GET /healthz`
- Strict startup validation defaults to on:
  - `STRICT_STARTUP_VALIDATION=true`
  - App fails fast if required AI env vars are missing

## 4. Quick Checks

After deploy:

1. `GET /healthz` returns `{"ok": true, ...}`
2. `POST /jobs/test-k2` returns `{"ok": true, ...}`
3. Optional: `POST /jobs/agent-tts` works only if ElevenLabs key is set
