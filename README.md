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

## Data Modes (No DB now, MySQL later)

This project supports two modes:

- `DATA_MODE=memory` (default): no database required, ideal for local testing.
- `DATA_MODE=mysql`: full Prisma + MySQL mode.

Switching is just environment config:

1. In `apps/api/.env`, set `DATA_MODE=memory` for testing now.
2. When ready, set `DATA_MODE=mysql` and set `DATABASE_URL`.
3. Run Prisma commands, then restart API.

## Project Structure

- `apps/mobile` - Expo app (iOS, Android, and web)
- `apps/api` - Express + TypeScript + Prisma API (MySQL)

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

If `DATA_MODE=mysql`, also set:

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

Run this only when `DATA_MODE=mysql`:

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

## Switching from Testing to MySQL

When you're done testing in memory mode and ready to use your MySQL server:

1. Open `apps/api/.env`
2. Set `DATA_MODE=mysql`
3. Set `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/mrc`
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

### 2) Deploy API (Railway/Render/Fly)

This API uses Socket.IO and upload storage, so a long-running Node host is recommended for testing.

Set environment variables on your API host:

- `DATA_MODE=mysql`
- `DATABASE_URL=<your-mysql-url>`
- `JWT_SECRET=<24+ chars>`
- `CLIENT_ORIGIN=https://<your-vercel-domain>`

Run once on the API host:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 3) Deploy web app on Vercel

Import this repository in Vercel and configure the project with:

- Root Directory: `apps/mobile`
- Build Command: `npm run build:web`
- Output Directory: `dist`
- Install Command: `npm install`

Set Vercel environment variable:

- `EXPO_PUBLIC_API_URL=https://<your-api-domain>/api`

The file `apps/mobile/vercel.json` is already included with SPA rewrites.
