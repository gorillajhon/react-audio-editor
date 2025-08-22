// Build Enhanced LRC from word timings
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

function lrcTime(t:number){
  const m = Math.floor(t/60).toString().padStart(2,'0')
  const s = Math.floor(t%60).toString().padStart(2,'0')
  const cs = Math.floor((t%1)*100).toString().padStart(2,'0') // centiseconds
  return `${m}:${s}.${cs}`
}

export async function POST(req: NextRequest){
  const { words } = await req.json()
  if (!Array.isArray(words)) return new Response('Bad payload', { status: 400 })
  // Single line with per-word timestamps (Enhanced LRC format)
  const line = words.map((w:any) => `[${lrcTime(w.start)}]${w.word}`).join(' ')
  const out = `[00:00.00]Lyrics\n${line}\n`
  return new Response(out, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
