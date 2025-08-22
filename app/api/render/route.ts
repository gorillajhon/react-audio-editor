// Render 400x400 black video with burnt-in white subtitles
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest } from 'next/server'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'
import { tmpdir } from 'os'
import { writeFileSync, readFileSync } from 'fs'
import path from 'path'

if (ffmpegPath) {
  // @ts-ignore
  ffmpeg.setFfmpegPath(ffmpegPath)
}

export async function POST(req: NextRequest){
  const form = await req.formData()
  const audio = form.get('audio') as File | null
  const subs = form.get('subs') as File | null
  if(!audio || !subs) return new Response('Missing files', { status: 400 })

  const bufA = Buffer.from(await audio.arrayBuffer())
  const bufS = Buffer.from(await subs.arrayBuffer())

  const inA = path.join(tmpdir(), `a-${Date.now()}.mp3`)
  const inS = path.join(tmpdir(), `s-${Date.now()}.srt`)
  const outV = path.join(tmpdir(), `v-${Date.now()}.mp4`)
  writeFileSync(inA, bufA)
  writeFileSync(inS, bufS)

  const escaped = inS.replace(/:/g, '\\:').replace(/\\/g, '\\\\')
  const style = "force_style='Fontname=Arial,PrimaryColour=&HFFFFFF&,BackColour=&H000000&,OutlineColour=&H000000&,BorderStyle=3,Outline=2,Shadow=0,Alignment=2,Fontsize=20,MarginV=20'"

  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input('color=c=black:s=400x400') // solid background (length from audio)
      .input(inA)
      .videoCodec('libx264')
      .audioCodec('aac')
      .outputOptions(['-pix_fmt yuv420p','-shortest'])
      .complexFilter([`subtitles='${escaped}':${style}`])
      .on('end', ()=> resolve())
      .on('error', (e: any) => reject(e))
      .save(outV)
  })

  const out = readFileSync(outV)
  return new Response(out, { headers: { 'Content-Type': 'video/mp4' } })
}
