// Trim MP3 to region
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { tmpdir } from 'os';
import { createWriteStream, readFileSync } from 'fs';
import path from 'path';

if (ffmpegPath) {
  // @ts-ignore
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;

  console.log({ file });
  //return Response.json({ message: 'This feature is not implemented yet.' });
  const start = parseFloat((formData.get('start') as string) ?? '0');
  const end = parseFloat((formData.get('end') as string) ?? '0');
  if (!file) return new Response('No file', { status: 400 });
  if (!(end > start)) return new Response('Invalid range', { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const tmpIn = path.join(tmpdir(), `in-${Date.now()}.mp3`);
  const tmpOut = path.join(tmpdir(), `out-${Date.now()}.mp3`);
  await new Promise<void>((res) => {
    const ws = createWriteStream(tmpIn);
    ws.write(Buffer.from(arrayBuffer));
    ws.end(() => res());
  });

  try {
    await new Promise<void>((resolve, reject) => {
      ffmpeg(tmpIn)
        .setStartTime(start)
        .setDuration(end - start)
        .audioCodec('libmp3lame')
        .output(tmpOut)
        .on('end', () => resolve())
        .on('error', (e: any) => reject(e))
        .run();
    });
  } catch (error) {
    const err = (error as Error).message;
    console.log({ err });
  }

  return Response.json({ message: 'This feature is not implemented yet.' });
  /*

  const out = readFileSync(tmpOut)
  return new Response(out, { headers: { 'Content-Type': 'audio/mpeg' } }) */
}
