# AHMD.GPT Editor Ops

Internal platform for AHMD.GPT: contracted video editors submit finished videos and
track their earnings; the owner sees everything across every editor in one dashboard.

- **Editor portal** — `/portal/[editorCode]`: submit videos, see status and earnings.
- **Admin portal** — `/admin`: aggregated submissions, pricing, payouts, editor management.

Prices are in PKR, calculated as **duration × rate per minute** for every style —
editors always enter how long the video is. For standard styles the rate is set by
the admin (Styles tab) and shown read-only to the editor; "Custom" lets the editor
enter their own rate too, for one-off jobs.

## Local development

```bash
npx prisma dev   # starts a local Postgres (first time / if the DB isn't reachable)
npm run dev      # starts the app at http://localhost:3000
```

Seeded admin login (from `.env`): code `owner`, PIN `192837`.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 · Postgres · SWR

## Deploying

See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions to put this live on a real
database and hosting (Neon + Vercel), written for someone who's never set either up
before.
