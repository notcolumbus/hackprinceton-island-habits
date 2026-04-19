# hackprinceton-island-habits

Monorepo scaffold powered by Turborepo (Vercel) and npm workspaces.

## Quick start

```bash
npm install
npm run dev
```

## Workspace layout

```
.
└── apps
    ├── app
    ├── agent
    └── backend
```

## Useful scripts

- `npm run dev` runs all workspace dev scripts through Turbo.
- `npm run build` runs build tasks across workspaces.
- `npm run lint` runs lint scripts across workspaces.
- `npm run test` runs test scripts across workspaces.

## Running locally

Open three terminal tabs:

**1. Agent** (iMessage listener + HTTP server on port 3001)
```bash
cd apps/agent && npm run dev
```

**2. Backend** (Flask API on port 5001)
```bash
cd apps/backend && python3 app.py
```

**3. Frontend** (Vite on port 5173)
```bash
cd apps/app && npm run dev
```

Convex is hosted at `tidy-vole-519.convex.cloud` — no local Convex server needed.

---

## Knot Onboarding Setup

1. Frontend env:
   - Copy `apps/app/.env.example` to `apps/app/.env`.
   - Set `VITE_KNOT_CLIENT_ID` and `VITE_KNOT_ENVIRONMENT`.
2. Backend env:
   - Copy `apps/backend/.env.example` to `apps/backend/.env`.
   - Set `KNOT_CLIENT_ID`, `KNOT_SECRET`, and `KNOT_ENVIRONMENT`.
3. Run backend API:
   - `cd apps/backend && pip install -r requirements.txt && flask --app app run --port 5001`
4. Run frontend:
   - `npm --workspace @hackprinceton/app run dev`
