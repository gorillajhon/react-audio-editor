// UI: Upload → Trim → Transcribe → SRT/LRC → Render 400x400
'use client'
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
// @ts-ignore
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js'
import RabbitLyrics from 'rabbit-lyrics'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMusic } from '@fortawesome/free-solid-svg-icons';

type Segment = { start: number; end: number; text: string }
type Word = { start: number; end: number; word: string }

type Transcription = {
  segments: Segment[]
  words: Word[]
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }
function fmt(sec:number){ const m = Math.floor(sec/60); const s = Math.floor(sec%60).toString().padStart(2,'0'); return `${m}:${s}` }

export default function Home() {
  const [file, setFile] = useState<File | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [cutUrl, setCutUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'srt'|'lrc'>('srt') // 1) user said yes → support both

  const [segments, setSegments] = useState<Segment[]>([])
  const [words, setWords] = useState<Word[]>([])

  const [srtUrl, setSrtUrl] = useState<string | null>(null)
  const [lrcUrl, setLrcUrl] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const wsRef = useRef<any>(null)
  const regionRef = useRef<any>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [t, setT] = useState(0)

  const [start, setStart] = useState(0)
  const [duration, setDuration] = useState(60)
  const end = useMemo(()=> start+duration, [start, duration])
  const lyricsRef = useRef<HTMLDivElement | null>(null);

  useEffect(()=>{
    const el = audioRef.current
    if(!el) return
    /*const onTime = ()=> setT(el.currentTime)
    el.addEventListener('timeupdate', onTime)
    return ()=> el.removeEventListener('timeupdate', onTime) */
  }, [])

  useEffect(()=>{
    if (!containerRef.current || !audioUrl) return
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#6b7280',
      progressColor: '#22c55e',
      cursorColor: '#fff',
      height: 96,
      url: audioUrl,
    })
    const regions = ws.registerPlugin(RegionsPlugin.create())
    wsRef.current = ws
    ws.on('ready', () => {
      const dur = ws.getDuration()
      const end = Math.min(30, dur)
      //regionRef.current = regions.addRegion({ start: 0, end, color: 'rgba(34,197,94,0.2)' })
    })
    return () => { ws.destroy(); wsRef.current = null; regionRef.current = null }
  }, [audioUrl])

  /*useEffect(()=> {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      if (el.currentTime > end) { el.pause(); el.currentTime = start }
    }
    el.addEventListener('timeupdate', onTime)
    return ()=> el.removeEventListener('timeupdate', onTime)
  }, [start, end]) */

  useEffect(() => {
    let cleanup = () => {};
    (async () => {
      if (!lyricsRef.current) return;

      // Put the raw LRC text inside the container
      lyricsRef.current.textContent = `
      [00:06.00] When you're gonna stop breaking my heart?
[00:14.00] I don't wanna be another one
[00:21.00] Paying for the things I never done
[00:28.00] Don't let go, don't let go to my love
[00:48.00] Can I get to your soul?
[00:50.00] Can you get to my thought?
[00:52.00] Can we promise we won't let go?
[00:55.00] All the things that I need
[00:57.00] All the things that you need
[00:59.00] You can make it feel so real
[01:03.00] 'Cause you can't deny, you've blown my mind
[01:08.00] When I touch your body
[01:09.00] I feel I'm losing control
[01:10.00] 'Cause you can't deny, you've blown my mind 
      `;
      // Optional display mode (mini/full/default)
      lyricsRef.current.setAttribute('data-view-mode', 'default');

      // Dynamically import on the client to avoid SSR issues
      const { default: RabbitLyrics } = await import('rabbit-lyrics');

      // Initialize: constructor signature is (lyricsElement, mediaElement?)
      const instance = new RabbitLyrics(lyricsRef.current, audioRef.current || undefined);

      // minimal cleanup
      cleanup = () => {
        if (lyricsRef.current) lyricsRef.current.textContent = '';
      };
    })();

    return () => cleanup();
  }, []);

  const onUpload = (f: File) => {
    setFile(f); setSegments([]); setWords([]); setSrtUrl(null); setLrcUrl(null); setVideoUrl(null);
    const url = URL.createObjectURL(f); setAudioUrl(url); setCutUrl(null);
    setStart(0); setDuration(30);
  }

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (lyricsRef.current) {
      lyricsRef.current.style.backgroundColor = e.target.value
    }
  }

  useLayoutEffect(() => {
    if(lyricsRef.current){
      lyricsRef.current.style.backgroundColor = '#7f2e85';
      lyricsRef.current.style.borderColor = '#7f2e85';
      lyricsRef.current.style.borderRadius = '16px';
      lyricsRef.current.style.color = '#fff';
    }
  }, [])

  const cut = async () => {
    if (!file || !regionRef.current) return
    const form = new FormData()
    form.append('file', file)
    form.append('start', String(regionRef.current.start))
    form.append('end', String(regionRef.current.end))
    const res = await fetch('/api/cut', { method: 'POST', body: form })
    if (!res.ok) { alert('Cut failed'); return }
    const blob = await res.blob()
    setCutUrl(URL.createObjectURL(blob))
  }

  const transcribe = async () => {
    const src = cutUrl || audioUrl
    if (!src) return
    const blob = await (await fetch(src)).blob()
    const res = await fetch('/api/transcribe', { method: 'POST', body: blob })
    if (!res.ok) { alert('Transcription failed'); return }
    const data: Transcription = await res.json()
    setSegments(data.segments); setWords(data.words);
  }

  const buildSrt = async () => {
    const res = await fetch('/api/subtitles', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ segments }) })
    if (!res.ok) { alert('SRT build failed'); return }
    const blob = await res.blob()
    setSrtUrl(URL.createObjectURL(blob))
  }

  const buildLrc = async () => {
    const res = await fetch('/api/lyrics-lrc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words }) })
    if (!res.ok) { alert('LRC build failed'); return }
    const blob = await res.blob()
    setLrcUrl(URL.createObjectURL(blob))
  }

  const renderVideo = async () => {
    const form = new FormData()
    const src = cutUrl || audioUrl
    if (!src) return
    form.append('audio', await (await fetch(src)).blob(), 'audio.mp3')
    if (mode === 'srt') {
      if (!srtUrl) { await buildSrt() }
      form.append('subs', await (await fetch(srtUrl!)).blob(), 'lyrics.srt')
    } else {
      // For karaoke mode we currently render using SRT (line-by-line) for video,
      // and still provide LRC for clients that support karaoke highlighting.
      if (!srtUrl) { await buildSrt() }
      form.append('subs', await (await fetch(srtUrl!)).blob(), 'lyrics.srt')
    }
    const res = await fetch('/api/render', { method: 'POST', body: form })
    if (!res.ok) { alert('Render failed'); return }
    const blob = await res.blob()
    setVideoUrl(URL.createObjectURL(blob))
  }

  const playFromStart = () => { const el = audioRef.current; if (!el) return; el.currentTime = start; el.play() }

  const currentLine = segments.find(s => t >= s.start && t <= s.end)?.text ?? ''
  const currentWordIndex = words.findIndex(w => t >= w.start && t <= w.end)

  return (
    <main className="container">
      <h1 className="text-2xl font-semibold mb-2">Audio → Lyrics Video <FontAwesomeIcon icon={faMusic} color='white' /></h1>

      <div className="card" style={{marginBottom:12}}>
        <div className="row">
          <input type="file" accept="audio/mp3,audio/mpeg" onChange={e => e.target.files?.[0] && onUpload(e.target.files[0])} />
          {/*<select value={mode} onChange={e => setMode(e.target.value as any)}>
            <option value="srt">Line-by-line (SRT)</option>
            <option value="lrc">Karaoke (LRC preview)</option>
  </select> */}
          <button className="btn" disabled={!audioUrl} onClick={() => wsRef.current?.playPause()}>Play / Pause</button>
          <button className="btn">Add lyrics</button>
          {/*<button className="btn" onClick={cut}>Cut Region</button>
          <button className="btn" onClick={transcribe} disabled={!audioUrl}>Transcribe</button> 
         {<button className="btn" onClick={buildSrt} disabled={!segments.length}>Build SRT</button>
          <button className="btn" onClick={buildLrc} disabled={!words.length}>Build LRC</button>
  <button className="btn" onClick={renderVideo} disabled={!segments.length}>Render 400x400 MP4</button> */}
        </div>
        <div ref={containerRef} className="wave" style={{marginTop:12}} />
        <div className="legend">Drag the region edges to adjust (default 30s).</div>
      </div>

      <section className="card" style={{marginBottom:12}}>
        <h2>Preview</h2>
        <audio controls ref={audioRef} src={(cutUrl||audioUrl)||undefined} className="w-full" id="audio-1"/>
        <div className="legend">Window: {start.toFixed(1)}s → {end.toFixed(1)}s</div>
        <input type="color" onChange={handleColorChange}/>
        <div className="rabbit-lyrics" data-media="#audio-1" ref={lyricsRef}></div>

        {mode === 'srt' ? (
          <div style={{marginTop:12, textAlign:'center', fontSize:20, minHeight:32, fontWeight:600}}>{currentLine || '(no current line)'}</div>
        ) : (
          <div style={{marginTop:12, textAlign:'center', fontSize:20, minHeight:32}}>
            {words.length ? words.map((w, i) => (
              <span key={i} style={{fontWeight: i===currentWordIndex ? 700 : 400, color: i===currentWordIndex ? '#fff' : '#9aa3b2'}}>
                {w.word + ' '}
              </span>
            )): <span>(no words)</span>}
          </div>
        )}
        <div className="row" style={{marginTop:8}}>
          {srtUrl && <a className="btn" href={srtUrl} download="lyrics.srt">Download SRT</a>}
          {lrcUrl && <a className="btn" href={lrcUrl} download="lyrics.lrc">Download LRC</a>}
          {videoUrl && <a className="btn" href={videoUrl} download="lyrics.mp4">Download MP4</a>}
        </div>
      </section>

      <section className="card">
        <h2>Timestamps</h2>
        <div className="legend">Segments</div>
        <div style={{display:'grid', gap:4}}>
          {segments.map((s,i)=>(<div key={i}>[{fmt(s.start)} - {fmt(s.end)}] {s.text}</div>))}
          {!segments.length && <div className="legend">(no segments)</div>}
        </div>
        <div className="legend" style={{marginTop:8}}>Words</div>
        <div style={{display:'grid', gap:4}}>
          {words.map((w,i)=>(<div key={i}>[{fmt(w.start)} - {fmt(w.end)}] {w.word}</div>))}
          {!words.length && <div className="legend">(no words)</div>}
        </div>
      </section>
    </main>
  )
}
