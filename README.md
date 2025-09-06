# Audio → Lyrics Video (Next.js on Vercel)

- Upload MP3, trim a region, transcribe (stub), export SRT and Enhanced LRC, and render a 400×400 MP4 with white subtitles on black.
- Supports **mode**: line-by-line (SRT) and **karaoke preview** (LRC words). The rendered MP4 currently uses SRT (line-by-line).

## Dev
```bash
yarn install
yarn dev
```

## Render Notes (Vercel)
- API routes run with `runtime = 'nodejs'` and use `ffmpeg-static` (included).
- The MP4 is produced from a black color source at 400×400 with the SRT burned in using the `subtitles` filter (white text). If your deployment ffmpeg lacks `libass`, switch to a canvas/Remotion render pipeline.
- Karaoke (word-by-word) is provided as **LRC** for preview/download; burning karaoke highlighting into MP4 requires libass/ASS or a canvas renderer.

## Endpoints
- `POST /api/cut` — trim MP3 by start/end (seconds). Returns MP3.
- `POST /api/transcribe` — **stub**; returns `{ segments, words }` with timestamps.
- `POST /api/subtitles` — build SRT from segments.
- `POST /api/lyrics-lrc` — build Enhanced LRC from words.
- `POST /api/render` — render 400×400 MP4 with SRT.

## TODO for production
- Replace `/api/transcribe` with Whisper (word timestamps) or Google STT.
- Optional: implement ASS-based karaoke burn-in or a Puppeteer/Remotion renderer for word highlighting.
- Add persistence (Supabase/Firebase) for files and job status.
