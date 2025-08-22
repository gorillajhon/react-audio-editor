// Build SRT from segments
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'

function toSrt(segments: Array<{start:number; end:number; text:string}>) {
  const ms = (t:number)=>{
    const h = Math.floor(t/3600).toString().padStart(2,'0')
    const m = Math.floor((t%3600)/60).toString().padStart(2,'0')
    const s = Math.floor(t%60).toString().padStart(2,'0')
    const ms = Math.floor((t%1)*1000).toString().padStart(3,'0')
    return `${h}:${m}:${s},${ms}`
  }
  return segments.map((seg, i)=>`${i+1}\n${ms(seg.start)} --> ${ms(seg.end)}\n${seg.text}\n`).join('\n')
}

export async function POST(req: NextRequest){
  const { segments } = await req.json()
  const srt = toSrt(segments || [])
  return new Response(srt, { headers: { 'Content-Type': 'application/x-subrip' } })
}
