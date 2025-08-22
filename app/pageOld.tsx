'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Musixmatch‑style preview (simple):
 * - Upload MP3
 * - Choose a 30s window (editable)
 * - Paste ALL lyrics (or import LRC/SRT)
 * - We bold the word that's being sung during playback
 *
 * Notes
 * - LRC parser supports word‑level tags like [mm:ss.xx]word.
 * - SRT parser distributes word times evenly inside each subtitle span.
 * - "Sync evenly" distributes ALL pasted lyrics across the selected window
 *   (useful if you don't have timestamps yet).
 */

// ---------- Types ----------
type Segment = { start: number; end: number; text: string }
type Token = { text: string; isWord: boolean; start?: number; end?: number }

// ---------- Helpers ----------
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

function splitTokens(lyrics: string): Token[] {
  // Preserve whitespace/newlines so the layout looks like the pasted text
  return lyrics.split(/(\s+)/).map(t => ({ text: t, isWord: !/^\s+$/.test(t) }))
}

function evenSyncTokens(tokens: Token[], start: number, duration: number): Token[] {
  const words = tokens.filter(t => t.isWord)
  if (!words.length) return tokens
  const per = duration / words.length
  let cursor = start
  const next = tokens.map(t => {
    if (!t.isWord) return { ...t }
    const out: Token = { ...t, start: cursor, end: cursor + per }
    cursor += per
    return out
  })
  return next
}

function tsToSec(min: string, sec: string, fraction?: string) {
  const m = parseInt(min, 10) || 0
  const s = parseInt(sec, 10) || 0
  const f = parseInt((fraction || '0').padEnd(2, '0').slice(0, 2), 10) || 0 // centiseconds → 2 digits
  return m * 60 + s + f / 100
}

function parseLRC(lrc: string): Token[] {
  // Supports enhanced word-level like: [00:12.34]Hello [00:12.60]world
  const out: Token[] = []
  const lineRe = /^(.*)$/gm
  const tagRe = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g
  let m
  while ((m = lineRe.exec(lrc)) !== null) {
    const line = m[1]
    if (!line.trim()) { out.push({ text: '\n', isWord: false }); continue }

    let lastIdx = 0
    let tags: { idx: number; t: number }[] = []
    let tm
    while ((tm = tagRe.exec(line)) !== null) {
      tags.push({ idx: tm.index, t: tsToSec(tm[1], tm[2], tm[3]) })
    }

    if (!tags.length) { // no timestamps, just dump as plain text
      out.push(...splitTokens(line), { text: '\n', isWord: false })
      continue
    }

    // Remove tags from text while tracking where words start
    const clean = line.replace(tagRe, '')
    const words = clean.split(/(\s+)/)
    // Pair words with timestamps in order; if fewer tags than words, reuse last
    let ti = 0
    let lastT = tags[0].t
    for (const w of words) {
      if (/^\s+$/.test(w)) { out.push({ text: w, isWord: false }); continue }
      const start = (tags[ti]?.t ?? lastT)
      const end = (tags[ti + 1]?.t ?? start + 0.35)
      out.push({ text: w, isWord: true, start, end })
      lastT = start
      if (ti < tags.length - 1) ti++
    }
    out.push({ text: '\n', isWord: false })
  }
  return out
}

function parseSRT(srt: string): Token[] {
  // Turn SRT into word tokens with even distribution per subtitle span
  const blocks = srt.trim().split(/\n\s*\n/)
  const tokens: Token[] = []
  for (const b of blocks) {
    const lines = b.split(/\n/)
    const timeLine = lines.find(l => /-->/.test(l))
    const textLines = lines.filter(l => l && !/^\d+$/.test(l) && !/-->/.test(l))
    if (!timeLine || !textLines.length) continue
    const m = timeLine.match(/(\d\d):(\d\d):(\d\d),(\d\d\d)\s+-->\s+(\d\d):(\d\d):(\d\d),(\d\d\d)/)
    if (!m) continue
    const start = (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 1000
    const end = (+m[5]) * 3600 + (+m[6]) * 60 + (+m[7]) + (+m[8]) / 1000
    const text = textLines.join(' ')
    const parts = text.split(/(\s+)/)
    const words = parts.filter(p => !/^\s+$/.test(p))
    const per = (end - start) / Math.max(1, words.length)
    let cursor = start
    for (const p of parts) {
      if (/^\s+$/.test(p)) tokens.push({ text: p, isWord: false })
      else { tokens.push({ text: p, isWord: true, start: cursor, end: cursor + per }); cursor += per }
    }
    tokens.push({ text: '\n', isWord: false })
  }
  return tokens
}

function fmtTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

// ---- Build captions from tokens ----
function tokensToSegments(tokens: Token[]): Segment[] {
  const segs: Segment[] = []
  let curText = ''
  let curStart: number | null = null
  let curEnd: number | null = null
  const push = () => {
    if (curStart != null && curEnd != null && curText.trim()) {
      segs.push({ start: curStart, end: curEnd, text: curText.trim() })
    }
    curText = ''
    curStart = curEnd = null
  }
  for (const tok of tokens) {
    if (!tok.isWord) {
      if (tok.text === '') { push(); continue }
      curText += tok.text
      continue
    }
    if (tok.start == null || tok.end == null) continue
    if (curStart == null) curStart = tok.start
    curEnd = tok.end
    curText += tok.text + ' '
  }
  push()
  return segs
}

function toSrtFromTokens(tokens: Token[]): string {
  const segs = tokensToSegments(tokens)
  const ts = (t:number)=>{
    const h=String(Math.floor(t/3600)).padStart(2,'0')
    const m=String(Math.floor((t%3600)/60)).padStart(2,'0')
    const s=String(Math.floor(t%60)).padStart(2,'0')
    const ms=String(Math.floor((t%1)*1000)).padStart(3,'0')
    return `${h}:${m}:${s},${ms}`
  }
  return segs.map((seg,i)=>`${i+1}
${ts(seg.start)} --> ${ts(seg.end)}
${seg.text}
`).join('')
}

function toVttFromTokens(tokens: Token[]): string {
  const segs = tokensToSegments(tokens)
  const ts = (t:number)=>{
    const h=String(Math.floor(t/3600)).padStart(2,'0')
    const m=String(Math.floor((t%3600)/60)).padStart(2,'0')
    const s=String(Math.floor(t%60)).padStart(2,'0')
    const ms=String(Math.floor((t%1)*1000)).padStart(3,'0')
    return `${h}:${m}:${s}.${ms}`
  }
  return 'WEBVTT' + segs.map((seg,i)=>`${i+1}
${ts(seg.start)} --> ${ts(seg.end)}
${seg.text}`).join('')
}

function toLrcFromTokens(tokens: Token[]): string {
  const lines: string[] = []
  let cur: Token[] = []
  const lrcT = (t:number)=>{
    const m=String(Math.floor(t/60)).padStart(2,'0')
    const s=String(Math.floor(t%60)).padStart(2,'0')
    const cs=String(Math.floor((t%1)*100)).padStart(2,'0')
    return `${m}:${s}.${cs}`
  }
  const flush = () => {
    if (!cur.length) return
    const start = cur.find(t=>t.isWord && t.start!=null)?.start ?? 0
    const text = cur.map(t=>t.text).join('').trim()
    lines.push(`[${lrcT(start as number)}]${text}`)
    cur = []
  }
  for (const tok of tokens) {
    if (tok.isWord || tok.text !== '') cur.push(tok)
    else flush()
  }
  flush()
  return lines.join('') + ''
}

// ---------- Component ----------
export default function SimpleKaraoke() {
  const [file, setFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  // Selection window (30s default)
  const [start, setStart] = useState(0)
  const [duration, setDuration] = useState(30)
  const end = useMemo(() => start + duration, [start, duration])

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [t, setT] = useState(0)

  // Lyrics
  const [rawLyrics, setRawLyrics] = useState('')
  const [tokens, setTokens] = useState<Token[]>([])
  const [srtUrl, setSrtUrl] = useState<string|null>(null)
  const [vttUrl, setVttUrl] = useState<string|null>(null)
  const [lrcUrl, setLrcUrl] = useState<string|null>(null)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      setT(el.currentTime)
      if (el.currentTime > end) { el.pause(); el.currentTime = start }
    }
    el.addEventListener('timeupdate', onTime)
    return () => el.removeEventListener('timeupdate', onTime)
  }, [start, end])

  const onUpload = (f: File) => {
    setFile(f)
    setTokens([])
    const url = URL.createObjectURL(f)
    setAudioUrl(url)
    setStart(0); setDuration(30)
  }

  const playFromStart = () => { const el = audioRef.current; if (!el) return; el.currentTime = start; el.play() }

  // Build timings from the pasted lyrics using even spacing
  const syncEvenly = () => setTokens(evenSyncTokens(splitTokens(rawLyrics), start, duration))

  // Import LRC/SRT
  const autoTranscribe = async () => {
    try {
      if (!audioUrl) return
      const audioBlob = await (await fetch(audioUrl)).blob()
      // Server should accept raw audio body and return { words: [{start,end,word}], segments?: [] }
      const res = await fetch('/api/transcribe', { method: 'POST', body: audioBlob })
      if (!res.ok) { alert('Transcription failed'); return }
      const data = await res.json()
      const words = (data.words || []).map((w: any) => ({ text: (w.word ?? w.text ?? '').toString(), isWord: true, start: w.start, end: w.end }))
      // Build tokens (insert spaces between words for visual separation)
      const tks: Token[] = []
      words.forEach((w: any, i: number) => { tks.push(w); if (i < words.length - 1) tks.push({ text: ' ', isWord: false }) })
      setTokens(tks)
      setRawLyrics(words.map((w:any)=>w.text).join(' '))
    } catch (e) {
      console.error(e)
      alert('Transcription error — check /api/transcribe on the server')
    }
  }

  // Import LRC/SRT
  const onImportTimed = async (file: File) => {
    const text = await file.text()
    if (/\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/.test(text)) {
      setTokens(parseLRC(text))
    } else if (/-->/.test(text)) {
      setTokens(parseSRT(text))
    } else {
      // fallback: treat as plain lyrics
      setRawLyrics(text)
      setTokens(evenSyncTokens(splitTokens(text), start, duration))
    }
  }

  // Active word index (for accessibility / optional scroll)
  const activeIndex = tokens.findIndex(w => w.isWord && w.start != null && w.end != null && t >= (w.start as number) && t <= (w.end as number))

  async function sendCaptions(){
    try {
      // Prefer existing timed tokens; otherwise build even timing from pasted lyrics
      const words = (tokens.length ? tokens : evenSyncTokens(splitTokens(rawLyrics), start, duration))
        .filter(t => t.isWord && t.start != null && t.end != null)
        .map(t => ({ text: t.text, start: t.start as number, end: t.end as number }))

      const payload = { lyrics: rawLyrics, start, duration, words }
      const res = await fetch('/api/captions', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(payload) })

      if (res.ok) {
        const { srt, vtt, lrc } = await res.json()
        if (srt) setSrtUrl(URL.createObjectURL(new Blob([srt], { type: 'application/x-subrip' })))
        if (vtt) setVttUrl(URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })))
        if (lrc) setLrcUrl(URL.createObjectURL(new Blob([lrc], { type: 'text/plain' })))
        return
      }

      // Fallback: build locally
      const timed = tokens.length ? tokens : evenSyncTokens(splitTokens(rawLyrics), start, duration)
      setSrtUrl(URL.createObjectURL(new Blob([toSrtFromTokens(timed)], { type: 'application/x-subrip' })))
      setVttUrl(URL.createObjectURL(new Blob([toVttFromTokens(timed)], { type: 'text/vtt' })))
      setLrcUrl(URL.createObjectURL(new Blob([toLrcFromTokens(timed)], { type: 'text/plain' })))
    } catch (e) {
      console.error(e)
      const timed = tokens.length ? tokens : evenSyncTokens(splitTokens(rawLyrics), start, duration)
      setSrtUrl(URL.createObjectURL(new Blob([toSrtFromTokens(timed)], { type: 'application/x-subrip' })))
      setVttUrl(URL.createObjectURL(new Blob([toVttFromTokens(timed)], { type: 'text/vtt' })))
      setLrcUrl(URL.createObjectURL(new Blob([toLrcFromTokens(timed)], { type: 'text/plain' })))
    }
  }

  return (
    <div className="min-h-screen bg-[#0c2a22] text-[#daefe7] p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-2xl font-semibold">Lyrics Highlighter (simple Musixmatch‑style)</h1>

        {/* Upload */}
        <section className="rounded-2xl p-4 bg-black/30 border border-black/20">
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs mb-1">Upload MP3</label>
              <input type="file" accept="audio/mp3,audio/mpeg" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
            </div>
            <div className="flex gap-2">
              <button onClick={playFromStart} className="px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-700">Play from start</button>
              <button onClick={() => { const el = audioRef.current; if (el) el.pause() }} className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600">Pause</button>
            </div>
          </div>
          <div className="mt-3 p-3 rounded bg-black/40">
            <audio ref={audioRef} controls src={audioUrl ?? undefined} className="w-full" />
            <div className="mt-2 text-xs opacity-75">Window: <span className="font-medium">{start.toFixed(1)}s → {end.toFixed(1)}s</span></div>
          </div>
        </section>

        {/* Trim */}
        <section className="rounded-2xl p-4 bg-black/30 border border-black/20">
          <h2 className="text-lg font-medium mb-3">Trim window</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs mb-1">Start (sec)</label>
              <input type="number" min={0} step={0.1} value={start} onChange={e => setStart(clamp(parseFloat(e.target.value || '0'), 0, 10000))} className="w-full rounded bg-[#0f3a30] px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs mb-1">Duration (sec)</label>
              <input type="number" min={1} step={0.1} value={duration} onChange={e => setDuration(clamp(parseFloat(e.target.value || '30'), 1, 10000))} className="w-full rounded bg-[#0f3a30] px-3 py-2" />
            </div>
            <div className="text-xs opacity-75">Playback will loop within the window.</div>
          </div>
        </section>

        {/* Lyrics input + timing */}
        <section className="rounded-2xl p-4 bg-black/30 border border-black/20">
          <h2 className="text-lg font-medium mb-3">Lyrics + timing</h2>
          <textarea value={rawLyrics} onChange={e => setRawLyrics(e.target.value)} placeholder="Paste the full lyrics here..." className="w-full min-h-[120px] rounded bg-[#0f3a30] p-3" />
          <div className="flex flex-wrap gap-2 mt-2">
            <button onClick={autoTranscribe} disabled={!audioUrl} className="px-3 py-2 rounded bg-emerald-600 disabled:opacity-50 hover:bg-emerald-700">Auto transcribe (no paste)</button>
            <button onClick={syncEvenly} className="px-3 py-2 rounded bg-indigo-600 hover:bg-indigo-700">Sync evenly to window</button>
            <label className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 cursor-pointer">
              Import LRC/SRT
              <input type="file" accept=".lrc,.srt,text/plain" onChange={e => e.target.files?.[0] && onImportTimed(e.target.files[0])} className="hidden" />
            </label>
            <button onClick={() => { setTokens([]); }} className="px-3 py-2 rounded bg-zinc-700/60 hover:bg-zinc-600/60">Clear timing</button>
            <button onClick={sendCaptions} disabled={!tokens.length && !rawLyrics.trim()} className="px-3 py-2 rounded bg-fuchsia-600 disabled:opacity-50 hover:bg-fuchsia-700">Send to backend (build captions)</button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {srtUrl && <a className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600" href={srtUrl} download="clip.srt">Download SRT</a>}
            {vttUrl && <a className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600" href={vttUrl} download="clip.vtt">Download VTT</a>}
            {lrcUrl && <a className="px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600" href={lrcUrl} download="clip.lrc">Download LRC</a>}
          </div>
        </section>

        {/* Display lyrics with active word bolded */}
        <section className="rounded-2xl p-5 bg-[#103a30] border border-black/20">
          <h2 className="text-lg font-medium mb-4">Preview (bold = currently sung)</h2>
          <div className="text-[32px] leading-[1.3]" style={{ wordBreak: 'break-word' }}>
            {tokens.length ? tokens.map((tok, i) => {
              if (!tok.isWord) return <span key={i}>{tok.text}</span>
              const active = tok.start != null && tok.end != null && t >= (tok.start as number) && t <= (tok.end as number)
              return (
                <span key={i} style={{ fontWeight: active ? 800 as any : 500, opacity: active ? 1 : 0.75 }}>
                  {tok.text}
                </span>
              )
            }) : (
              <div className="opacity-70 text-xl">Paste lyrics and click <em>Sync evenly</em>, or import an <strong>.lrc</strong>/<strong>.srt</strong>.</div>
            )}
          </div>
        </section>

        {/* Raw debug (optional) */}
        <details className="rounded-2xl p-4 bg-black/20 border border-black/10">
          <summary className="cursor-pointer">Debug tokens</summary>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(tokens.slice(Math.max(0, activeIndex - 5), activeIndex + 5), null, 2)}</pre>
        </details>
      </div>
    </div>
  )
}
