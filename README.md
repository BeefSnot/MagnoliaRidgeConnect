# MRC (Magnolia Ridge Connect)

Full-stack Expo + React TypeScript community platform for Magnolia Ridge MHC (Van Buren, Arkansas).

## Included Features

- Resident registration with **unit number** and **manual approval** workflow.
- Approved users are assigned the **resident** role by default.
- Login/auth with JWT and role-based access control.
- Editable roles and permissions system.
- Live-style community feed (posts/comments + periodic refresh).
- Private/group messaging APIs and UI.
- Community events with Google Calendar integration endpoints.
- Google OAuth callback flow for storing calendar tokens.
- Polls with voting.
- Community moderation reports and moderation queue.
- Resident directory with profile visibility controls.
- Document center with acknowledgement tracking.
- Emergency alerts with read receipts.
- In-app notifications and push token registration endpoint.
- Admin user management and role assignment UI.
- Realtime socket events for posts, messages, and notifications.

## Data Modes (Quick Start)

This project supports two modes:

- `DATA_MODE=memory`: no database required.
- `DATA_MODE=database`: full Prisma mode (PostgreSQL on Vercel/Neon supported).

Switching is just environment config:

1. Set `DATA_MODE=memory` for local no-DB mode.
2. Set `DATA_MODE=database` + `DATABASE_URL` for deployed DB mode.
3. Deploy (Vercel build runs Prisma deploy automatically for API project).

## Project Structure

- `apps/mobile` - Expo app (iOS, Android, and web)
- `apps/api` - Express + TypeScript + Prisma API (PostgreSQL-ready)

## Setup

### 1) Install dependencies

From the repository root:

```bash
npm install
```

### 2) Configure backend environment

Copy:

- `apps/api/.env.example` -> `apps/api/.env`

Set at minimum:

- `DATA_MODE`
- `CLIENT_ORIGIN`

`JWT_SECRET` is optional in `DATA_MODE=memory` (a dev fallback is used automatically), but required for production use.

If `DATA_MODE=database`, also set:

- `DATABASE_URL`
- `JWT_SECRET` (24+ chars)

For Google Calendar sync, also set:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

### 3) Configure mobile environment

Copy:

- `apps/mobile/.env.example` -> `apps/mobile/.env`

Adjust:

- `EXPO_PUBLIC_API_URL`

### 4) Prisma generate/migrate/seed

Run this when `DATA_MODE=database`:

```bash
npm run --workspace apps/api prisma:generate
npm run --workspace apps/api prisma:migrate
npm run --workspace apps/api prisma:seed
```

Default seeded admin:

- email: `admin@mrc.local`
- password: `ChangeMeNow123!`

### 5) Run API and app

Single command (recommended):

```bash
npm run dev
```

This starts:

- API server
- Expo web site on `http://localhost:19006` (stale Expo ports are auto-cleared first)

Or separate terminals:

Terminal 1:

```bash
npm run dev:api
```

Terminal 2:

```bash
npm run dev:web
```

For Expo Go mobile, run an additional terminal:

```bash
npm run dev:mobile
```

Then run Expo on device, simulator, or web.

## Switching from Testing to Database Mode

When you're done testing in memory mode and ready to use your database:

1. Open `apps/api/.env`
2. Set `DATA_MODE=database`
3. Set `DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB?sslmode=require`
4. Run Prisma setup:

```bash
npm run --workspace apps/api prisma:generate
npm run --workspace apps/api prisma:migrate
npm run --workspace apps/api prisma:seed
```

5. Restart the API (`npm run dev:api` or `npm run dev`)

To go back to DB-free testing later, set `DATA_MODE=memory` and restart the API.

## Notes

- Calendar sync endpoint wiring is provided; add Google OAuth token exchange/callback handler for full production sync.
- Socket.IO is enabled in backend for real-time channels; UI currently uses reliable periodic refresh for cross-platform simplicity.
- This is a full scaffold and production baseline; add final deployment hardening (HTTPS, secrets manager, logging, rate limiting, backups).

## Expo Go Commands

From repo root, after Node/npm are installed:

```bash
npm install
```

Run API:

```bash
npm run dev:api
```

Run web:

```bash
npm run dev:web
```

Run mobile for Expo Go:

```bash
npm run dev:mobile
```

In Expo CLI, press `s` if needed to switch to tunnel/lan mode, then scan QR in Expo Go.

## Deploy (Testing)

### 1) Push to GitHub

```bash
git add .
git commit -m "Prepare deployment"
git push -u origin main
```

### 2) Deploy one Vercel project (web + api)

Import this repository in Vercel as a single project and configure:

- Root Directory: `.`
- Build Command: `npm run vercel-build`
- Output Directory: `apps/mobile/dist`
- Install Command: `npm install`

Set environment variables in this single Vercel project:

- `DATA_MODE=database`
- `DATABASE_URL=<your-vercel/neon-postgres-url>`
- `JWT_SECRET=<24+ chars>`
- `CLIENT_ORIGIN=https://<your-project>.vercel.app`
- `EXPO_PUBLIC_API_URL=/api`

This repo now includes root `vercel.json` and root `api/[...all].ts` so `/api/*` routes hit the Express API while web files are served from the same deployment.

`vercel-build` runs Prisma (`prisma db push`) so first deploy can create tables without an interactive terminal.

### Vercel note

Realtime Socket.IO and persistent local file uploads are limited on serverless platforms. Core HTTP + database features work, and this setup is meant for fast testing deployment.
