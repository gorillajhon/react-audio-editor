// Return timestamped lines + words (stub). Replace with Whisper for prod.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  // In real code, pass audio to Whisper (word_timestamps) and compute segments + words.
  const text = 'This is only a sample lyric line for preview'
  const words = text.split(' ')
  const base = 0.5
  const dur = 8.0
  const per = dur / words.length
  let t = base
  const wordObjs = words.map((w) => {
    const start = t; const end = t + per; t = end
    return { start, end, word: w }
  })
  const segments = [
    { start: base, end: base + dur, text }
  ]
  return Response.json({ segments, words: wordObjs })
}
