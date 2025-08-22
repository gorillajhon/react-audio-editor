// Quick tests for SRT time formatting + LRC structure
function ms(t){ const h=String(Math.floor(t/3600)).padStart(2,'0'); const m=String(Math.floor((t%3600)/60)).padStart(2,'0'); const s=String(Math.floor(t%60)).padStart(2,'0'); const ms=String(Math.floor((t%1)*1000)).padStart(3,'0'); return `${h}:${m}:${s},${ms}` }
function toSrt(segments){ return segments.map((seg,i)=>`${i+1}\n${ms(seg.start)} --> ${ms(seg.end)}\n${seg.text}\n`).join('\n') }
function lrcTime(t){ const m=String(Math.floor(t/60)).padStart(2,'0'); const s=String(Math.floor(t%60)).padStart(2,'0'); const cs=String(Math.floor((t%1)*100)).padStart(2,'0'); return `${m}:${s}.${cs}` }

(function run(){
  const segs=[{start:0,end:1.5,text:'hello'},{start:1.5,end:3,text:'world'}]
  const srt=toSrt(segs)
  if(!srt.includes('00:00:00,000')||!srt.includes('00:00:01,500')||!srt.endsWith('\n')){
    console.error('SRT test failed'); process.exit(1)
  }
  const words=[{start:0.5, end:0.9, word:'This'},{start:0.9,end:1.3, word:'is'}]
  const line=words.map(w=>`[${lrcTime(w.start)}]${w.word}`).join(' ')
  if(!/^\[\d{2}:\d{2}\.\d{2}\]/.test(line)){ console.error('LRC test failed'); process.exit(1) }
  console.log('All quick tests passed.')
})()
