"use client";

import React, { FC, useEffect, useMemo, useRef, useState } from "react";

/** Minimal LRC parser */
function parseLRC(lrcText: string) {
  const lines = lrcText
    .split(/\r?\n/)
    .map((raw) => {
      const m = raw.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2}))?\]\s*(.*)$/);
      if (!m) return null;
      const mm = parseInt(m[1], 10);
      const ss = parseInt(m[2], 10);
      const cs = m[3] ? parseInt(m[3], 10) : 0; // centiseconds
      const time = mm * 60 + ss + cs / 100;
      return { time, text: m[4] ?? "" };
    })
    .filter(Boolean) as { time: number; text: string }[];

  // compute endTime for each line from the next line’s start
  for (let i = 0; i < lines.length; i++) {
    (lines[i] as any).endTime = lines[i + 1]?.time ?? Number.POSITIVE_INFINITY;
  }
  return lines as Array<{ time: number; endTime: number; text: string }>;
}

type Props = {
  audioSrc: string; // URL or /path/to/audio.mp3
  lrcText: string; // Your LRC (the timestamped lines)
  startTime: number; // seconds (e.g., 48 for [00:48.00])
  durationSec?: number; // default 30
  width?: number; // default 1080
  height?: number; // default 1920
  fileBaseName?: string; // default 'lyric-clip'
};

const LyricClipper: FC<Props> = ({
  audioSrc,
  lrcText,
  startTime = 0,
  durationSec = 10,
  width = 1080,
  height = 1920,
  fileBaseName = "lyric-clip",
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const entries = useMemo(() => parseLRC(lrcText), [lrcText]);

  // Draw loop
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    function draw() {
      const audio = audioRef.current!;
      const now = audio.currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Background
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Find current & next lines
      const idx = entries.findIndex((e) => now >= e.time && now < e.endTime);
      const current = idx >= 0 ? entries[idx] : null;
      const next = idx >= 0 ? entries[idx + 1] : null;

      // Title bar (optional)
      ctx.font = "40px Montserrat, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#bbb";
      ctx.fillText("Lyric Clip", canvas.width / 2, 100);

      // Current line
      ctx.font = "bold 72px Montserrat, sans-serif";
      ctx.textAlign = "center";
      if (current) {
        // progress (0..1) over current line
        const p = Math.min(
          1,
          Math.max(0, (now - current.time) / (current.endTime - current.time))
        );

        // Highlight background bar
        const margin = 120;
        const y = canvas.height / 2;
        ctx.fillStyle = "#111";
        ctx.fillRect(margin, y - 80, canvas.width - margin * 2, 120);

        // Progress bar
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(margin, y + 50, (canvas.width - margin * 2) * p, 8);

        // Text with two-tone “highlight” effect
        const text = current.text || " ";
        ctx.fillStyle = "#fff";
        ctx.fillText(text, canvas.width / 2, y);

        // subtle glow
        ctx.shadowColor = "rgba(34,197,94,0.6)";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#22c55e";
        ctx.fillText(text, canvas.width / 2, y);
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = "#555";
        ctx.fillText("…", canvas.width / 2, canvas.height / 2);
      }

      // Next line (smaller, below)
      if (next) {
        ctx.font = "48px Montserrat, sans-serif";
        ctx.fillStyle = "#999";
        ctx.fillText(
          next.text || " ",
          canvas.width / 2,
          canvas.height / 2 + 150
        );
      }

      raf = requestAnimationFrame(draw);
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [entries]);

  // Main record function
  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);

    const canvas = canvasRef.current!;
    const audio = audioRef.current!;

    // Prepare media streams
    const vStream = (canvas as HTMLCanvasElement).captureStream(30); // 30 fps
    // Chrome supports captureStream() for <audio> to get audio track
    // If not available, fallback to WebAudio routing:
    let aStream: MediaStream;
    if ((audio as any).captureStream) {
      aStream = (audio as any).captureStream();
    } else if ((audio as any).mozCaptureStream) {
      aStream = (audio as any).mozCaptureStream();
    } else {
      // Web Audio fallback
      const ctx = new AudioContext();
      const source = ctx.createMediaElementSource(audio);
      const dest = ctx.createMediaStreamDestination();
      source.connect(dest);
      source.connect(ctx.destination);
      aStream = dest.stream;
    }

    const mixed = new MediaStream([
      ...vStream.getVideoTracks(),
      ...aStream.getAudioTracks(),
    ]);

    chunksRef.current = [];
    const rec = new MediaRecorder(mixed, {
      mimeType: "video/mp4",
    });
    recorderRef.current = rec;

    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBaseName}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };

    // Seek & go
    audio.currentTime = startTime;
    await audio.play();
    rec.start();

    // Stop neatly after duration
    setTimeout(() => {
      rec.stop();
      audio.pause();
    }, durationSec * 1000);
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          width: width / 2,
          height: height / 2,
          background: "#000",
          borderRadius: 16,
        }}
      />
      <audio ref={audioRef} src={audioSrc} preload="auto" />
      <div className="flex gap-8">
        <button
          onClick={startRecording}
          disabled={isRecording}
          style={{
            padding: "10px 18px",
            borderRadius: 12,
            background: isRecording ? "#555" : "#22c55e",
            color: "#fff",
            cursor: isRecording ? "not-allowed" : "pointer",
          }}
        >
          {isRecording ? "Recording…" : "Record 30s Clip"}
        </button>
      </div>
    </div>
  );
};

export default LyricClipper;
