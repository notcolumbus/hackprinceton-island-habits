# Island of Habits

> **Your habits. Your island. Their problem.**

A multiplayer idle game where real-life productivity directly shapes your digital world — built at HackPrinceton.

---

## Inspiration

We started with a simple question: What if the games we play didn't just live on our screens, but actually became a part of our daily lives? We wanted to completely disrupt how users interact with games by blurring the line between the physical and digital worlds. Instead of grinding for hours with a mouse and keyboard, we envisioned a game where completing real-life tasks directly dictates your in-game success.

But a living world needs living inhabitants. We were tired of the generic, scripted NPCs found in traditional games. To fix this, we integrated AI agents that have a mind of their own. Rather than just repeating lines of dialogue, our agents converse with one another and actively gossip about the players. Knowing that the townspeople are talking behind your back about the real-world chores you did (or didn't!) finish brings a hilarious and unprecedented level of immersion to the experience.

---

## What It Does

Island of Habits is a multiplayer idle game that requires users to take action in their real lives to progress in the digital world. By assigning daily quests linked to an autonomous in-game AI agent, the game holds you accountable for your real-life productivity. Each agent acts as a friend and coach — someone you genuinely don't want to let down, making it easier to reach goals when you have someone depending on you.

Here is how the gameplay loop connects your real world to the digital one:

After being added to a DM or group chat, an AI agent generates a digital world and invites the user with a clickable link. Users go through an onboarding process and define their overarching goals.

Once started, users receive their own in-game agent whose sole purpose is to collect resources (rocks and logs) to build structures. Building structures grants islanders XP, leveling up the group. Reaching certain levels unlocks cool structures and new islands to explore.

Every agent has a **motivation meter** directly tied to real-world actions. Completing goals boosts motivation; failing them tanks it. Low-motivation agents move slower, collect fewer resources, and — most importantly — gossip about you to the other agents on the island. To beat the island, everyone needs to stay productive so their agents thrive, collect resources, build structures, and progress together.

---

## Why We Stand Out

**Injecting into existing networks.** Instead of forcing users to build a new network from scratch, we inject your game into established friend groups. This creates immediate, high-stakes accountability because players are performing for people whose opinions they already value in real life.

**The Tamagotchi Effect.** We shift the psychology of productivity from "selfish" to "selfless." Players aren't just checking off a to-do list for themselves; they are caring for a digital proxy that relies entirely on them to survive and thrive. It taps into our innate human desire to nurture and protect.

**AI roast culture as a coping mechanism.** Your agent will trash talk you in front of your friends. When people fail their goals, shame spirals and procrastination often follow. Having an AI roast you softens the blow of failure through comedy, introducing lighthearted peer pressure without making the player feel genuinely attacked by their actual human friends.

---

## How We Built It

The system is designed as a real-time, multi-surface experience powered by a combination of frontend, backend, AI, and messaging infrastructure.

### Core Stack

| Layer | Technology |
|---|---|
| Frontend | React, Vite, TypeScript |
| Frontend Hosting | Vercel |
| 3D Rendering | Three.js with React Three Fiber |
| Database & Sync | Convex |
| Authentication | Clerk (phone number based) |
| Messaging Layer | Photon iMessage with Spectrum.ts |
| LLM Model | K2 Think V2 |
| Image Processing | Google Gemma |
| Voice | ElevenLabs text-to-speech |
| Backend Jobs | Python Flask on DigitalOcean |
| Transaction Integration | Knot API |
| Monorepo | Turborepo |

### Frontend

The web app is mobile-first and renders a low-poly 3D island. Players can move around, place buildings, and see agents interacting in real time. State is managed through a centralized provider and synced through Convex reactive queries.

### Real-Time Sync

Convex acts as the single source of truth. Any change — a check-in, building placement, motivation update — propagates instantly across all connected clients without requiring custom WebSocket infrastructure.

### iMessage Agent

The Photon agent allows players to interact with the game entirely through iMessage. Players can:

- Start or join islands
- Check in on goals
- Manage goals
- Vote on major decisions
- Receive updates and messages

This makes the game feel ambient rather than something you have to open manually.

### AI Layer

K2 Think V2 powers every piece of generated text:

- Goal validation
- Agent personality creation
- Morning reminders
- Gossip between agents
- Weekly summaries
- Major narrative moments like ascension

Each agent has a persistent personality stored as structured data, injected into every AI call so the character stays consistent over time.

### Backend Jobs

All scheduled and event-driven behavior runs in Python on DigitalOcean:

- Morning reminders
- Miss detection at end of day
- Build progression
- Weekly summaries
- Gossip generation
- Reward generation

### Transaction-Based Habits

Through Knot API, users can optionally connect real-world transactions. For example, we can verify whether you ate at McDonald's or not, keeping you accountable for healthy eating.

---

## Challenges We Ran Into

**Consistent agent personalities.** Each message is generated independently, so we had to design prompts and data structures that preserve tone and behavior over time.

**Multi-surface synchronization.** Players might interact through iMessage while others are actively viewing the island. Convex's real-time backend and a strong syncing strategy let us avoid building custom networking infrastructure.

**3D performance on mobile.** Rendering a smooth experience on mobile browsers required careful optimization to balance performance constraints with visual quality.

**Phone number identity.** Normalizing phone numbers into a consistent format across different input formats was necessary for reliable cross-system communication.

**Structured AI outputs.** Model responses are not always perfectly formatted, so we built robust parsing logic to handle variability.

---

## Accomplishments

- 100% satisfaction rate from fellow HackPrinceton beta testers.
- A fully interactive multiplayer system where real-world actions directly affect a shared virtual environment.
- AI agents that feel consistent and expressive over time without fine-tuning or persistent sessions.
- An experience that lives naturally inside iMessage, reducing friction and increasing engagement.
- Real-time synchronization across all players without custom networking infrastructure.
- Multiple external systems combined into one cohesive product where each integration plays a meaningful role.

---

## What's Next

- Move from manually triggered jobs to fully persistent scheduled execution so the system runs continuously.
- Build a timelapse feature that shows the full history of an island over time.
- Explore AI-generated monuments that reflect each group's unique journey.
- Deepen the Knot integration so habits can be verified automatically without manual input.
- Expand support beyond iOS to reach more users.

---

## Quick Start

```bash
npm install
npm run dev
```

## Workspace Layout

```
.
└── apps
    ├── app       # Frontend (React + Vite)
    ├── agent     # iMessage agent (Photon + Spectrum.ts)
    └── backend   # Scheduled jobs (Python Flask)
```

## Useful Scripts

- `npm run dev` — runs all workspace dev scripts through Turbo
- `npm run build` — runs build tasks across workspaces
- `npm run lint` — runs lint scripts across workspaces
- `npm run test` — runs test scripts across workspaces

## Running Locally

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

Convex is hosted at `befitting-mink-857.convex.cloud` — no local Convex server needed.

---

## Knot Onboarding Setup

1. **Frontend env:**
   - Copy `apps/app/.env.example` to `apps/app/.env`
   - Set `VITE_KNOT_CLIENT_ID` and `VITE_KNOT_ENVIRONMENT`
2. **Backend env:**
   - Copy `apps/backend/.env.example` to `apps/backend/.env`
   - Set `KNOT_CLIENT_ID`, `KNOT_SECRET`, and `KNOT_ENVIRONMENT`
3. **Run backend API:**
   ```bash
   cd apps/backend && pip install -r requirements.txt && flask --app app run --port 5001
   ```
4. **Run frontend:**
   ```bash
   npm --workspace @hackprinceton/app run dev
   ```
