# AHMD.GPT Editor Ops

Internal platform for AHMD.GPT: contracted video editors submit finished videos and
track their earnings; the owner sees everything across every editor in one dashboard.

- **Editor portal** — `/portal/[editorCode]`: submit videos, see status and earnings.
- **Admin portal** — `/admin`: aggregated submissions, pricing, payouts, editor management.
- **Testimonial reel** — `/admin/reel`: drop a client's raw clip, get a finished
  1080×1920 branded reel. Owner-only.

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

## Testimonial reel generator

`/admin/reel` composites a raw client testimonial into the AHMD.GPT template and
returns a ready-to-post 1080×1920 MP4 with the original audio intact.

**Rendering happens server-side with FFmpeg**, never in the browser — canvas +
`MediaRecorder` exports in realtime, drops audio, and fails outright on iOS Safari.
The binaries ship with the app via `@ffmpeg-installer/ffmpeg`, so there is nothing
to install; set `FFMPEG_PATH` / `FFPROBE_PATH` to use your own build instead.

How a render works:

1. The browser streams the file to `POST /api/reel/upload` as a raw body (not
   multipart), so it goes straight to a temp dir instead of being buffered in
   memory, and XHR can report real upload progress.
2. `ffprobe` validates it and reports the true display dimensions — rotation
   metadata included, which is how iPhone portrait clips are stored — and that
   picks the 9:16 or 16:9 card.
3. `POST /api/reel/render` starts FFmpeg and returns immediately; the page polls
   `GET /api/reel/jobs/:id` for progress.
4. FFmpeg cover-scales and crops the clip into the card, rounds the corners with
   an alpha matte, overlays it onto a pre-rendered brand plate, and copies the
   audio through to AAC. Output is H.264 `yuv420p` with `+faststart`.

What moves in the finished video:

- **Live waveform** — `showwaves` draws a red trace under the stars straight from
  the clip's own audio, so it moves with the client's voice. Silent clips skip it
  and keep the stars alone. `cbrt` amplitude scaling, because speech sits low
  against full scale and would otherwise render as a near-flat line.
- **Per-frame grain** — applied by `noise` on the luma plane rather than baked
  into the plate, so it behaves like film instead of a frozen tile. Strength is
  deliberately low (5): at 8 the same 30s clip encoded to 27.6 MB instead of
  7.8 MB, for grain nobody would notice was stronger.
- **Intro** — the text layer (logo, status, headline, stars) fades and eases up
  over 0.6s. It is rendered as a separate alpha plate so the video card, which
  must stay pinned to the matte, never moves with it.

The background itself is intentionally static.

The brand plate is generated from `src/lib/reel/svg.ts` — the *same* SVG the live
preview renders in the DOM, so what you see is what you get. Server-side it is
rasterised by resvg using the real Syne / JetBrains Mono files in
`assets/reel-fonts/`, because a server has no webfonts and would otherwise
silently substitute something else. All geometry lives in `src/lib/reel/spec.ts`.

Two things the preview can only approximate: the waveform is drawn from a fixed
sample set (the real one depends on the audio), and grain is the static CSS tile
rather than per-frame noise. Everything else is positionally identical.

```bash
npm run reel:selftest      # end-to-end FFmpeg check, no browser involved
npm run reel:bake -- ./out # write the background plates out to inspect them
```

Uploads are capped at 1 GB (`REEL_MAX_UPLOAD_MB`). Renders live in the system temp
dir and are swept after two hours — download the file when it's ready.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · Prisma 7 · Postgres · SWR
· FFmpeg · resvg · sharp

## Deploying

See [DEPLOY.md](./DEPLOY.md) for step-by-step instructions to put this live on a real
database and hosting (Neon + Vercel), written for someone who's never set either up
before.
