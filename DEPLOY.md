# Going live

This app runs locally right now against a temporary database on your computer. To make
it a real, always-on app that your editors and you can use from anywhere, you need two
free accounts: one for the database, one for hosting. Both take a few minutes and
neither requires a credit card.

## 1. Create a database (Neon)

1. Go to [neon.tech](https://neon.tech) and sign up (GitHub or Google login is fastest).
2. Create a new project. Any name/region is fine.
3. On the project dashboard, find the **Connection string** (sometimes under
   "Connect" or "Quickstart"). It looks like:
   `postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require`
4. Copy it — you'll paste it into Vercel in step 3 below.

*(Supabase or Prisma Postgres work the same way if you'd rather use those — just grab
their Postgres connection string instead.)*

## 2. Push this code to GitHub

If it isn't already:

```bash
git add -A
git commit -m "Initial version"
```

Then create a new empty repo on [github.com/new](https://github.com/new) and follow
its instructions to push this folder to it.

## 3. Deploy on Vercel

1. Go to [vercel.com](https://vercel.com), sign up, and click **Add New → Project**.
2. Import the GitHub repo you just created.
3. Before clicking Deploy, open **Environment Variables** and add:
   - `DATABASE_URL` — the Neon connection string from step 1
   - `SESSION_SECRET` — a random string (generate one by running
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
     on your computer and pasting the output)
   - `ADMIN_NAME`, `ADMIN_CODE`, `ADMIN_PIN` — whatever you want your own owner
     login to be (e.g. `Ahmed`, `owner`, `847213`). Pick a PIN that isn't `123456`.
   - `INVOICE_PASSWORD` — the second password that unlocks the Invoices tab, so
     that someone with the owner login still can't see client billing. If you
     leave this unset the app falls back to a default that's visible in the
     source code, so set it to something only you know.
4. Click **Deploy**.

## 4. Set up the database tables

Once deployed, run this once from your computer (with the same `DATABASE_URL` from
step 1) to create the tables and your admin account:

```bash
DATABASE_URL="paste-your-neon-url-here" npx prisma migrate deploy
DATABASE_URL="paste-your-neon-url-here" ADMIN_NAME="Ahmed" ADMIN_CODE="owner" ADMIN_PIN="847213" npx prisma db seed
```

(On Windows PowerShell, set each variable with `$env:DATABASE_URL = "..."` on its own
line first, then run the command without the prefix.)

That's it — your Vercel URL is now a live, multi-user app. Log in at `/admin` with the
owner code/PIN you chose, add your editors from the Editors tab, and share each
editor's `/portal/<code>` link with them.

## Ongoing local development

Local dev uses a temporary Postgres server that Prisma manages for you — no install
needed. If `npm run dev` can't reach the database, run this in a separate terminal
first:

```bash
npx prisma dev
```

Leave it running, then start the app as usual with `npm run dev`.

## Known limitation: login rate limiting

Failed-login rate limiting (`src/lib/rate-limit.ts`) is in-memory — it resets on
deploy and doesn't share state across multiple server instances. It's enough to slow
down casual PIN guessing on a small deployment. If this ever needs to be bulletproof
at scale, swap it for a shared store like Upstash Redis.
