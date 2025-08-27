"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

// ---------- LRC parsing ----------
function parseLRC(lrcText: string) {
  const rows = lrcText
    .split(/\r?\n/)
    .map((raw) => {
      const m = raw.match(/^\[(\d{2}):(\d{2})(?:\.(\d{2}))?\]\s*(.*)$/);
      if (!m) return null;
      const mm = parseInt(m[1], 10);
      const ss = parseInt(m[2], 10);
      const cs = m[3] ? parseInt(m[3], 10) : 0;
      const t = mm * 60 + ss + cs / 100;
      return { time: t, text: m[4] ?? "" };
    })
    .filter(Boolean) as { time: number; text: string }[];
  for (let i = 0; i < rows.length; i++) {
    (rows[i] as any).endTime = rows[i + 1]?.time ?? Number.POSITIVE_INFINITY;
  }
  return rows as Array<{ time: number; endTime: number; text: string }>;
}

// ---------- helpers ----------
const pickMime = () => {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2", // Safari
    "video/mp4",
    "video/webm;codecs=vp9,opus", // Chromium
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const t of candidates) {
    if (
      typeof MediaRecorder !== "undefined" &&
      MediaRecorder.isTypeSupported(t)
    )
      return t;
  }
  return "";
};
const extFromMime = (m: string) => (m.includes("mp4") ? "mp4" : "webm");

async function waitFonts() {
  const fonts: any = (document as any).fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {}
  }
}

interface Props {
  lrcText: string;
  startTime?: number;
  durationSec?: number;
  width?: number;
  height?: number;
  fps?: number;
  fileBaseName?: string;
  /** Provide your own audio element ref (optional) */
  audioRef?: React.RefObject<HTMLAudioElement> | null;
  /** Provide audio src if you don’t pass an external <audio> */
  audioSrc?: string;
}

const CanvasLyricRecorder: React.FC<Props> = ({
  lrcText,
  startTime = 0,
  durationSec = 30,
  width = 1080,
  height = 700,
  fps = 30,
  fileBaseName = "lyric-clip",
  audioRef: externalAudioRef,
  audioSrc,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = externalAudioRef || internalAudioRef;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const entries = useMemo(() => parseLRC(lrcText), [lrcText]);

  // Canvas draw loop (driven by audio currentTime)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    function wrapText(text: string, maxWidth: number, fontPx: number) {
      ctx.font = `bold ${fontPx}px Montserrat, system-ui, sans-serif`;
      const words = text.split(" ");
      const lines: string[] = [];
      let current = "";
      for (const w of words) {
        const test = current ? `${current} ${w}` : w;
        const wWidth = ctx.measureText(test).width;
        if (wWidth > maxWidth && current) {
          lines.push(current);
          current = w;
        } else {
          current = test;
        }
      }
      if (current) lines.push(current);
      return lines;
    }

    function drawFrame() {
      if (!audioRef.current) return;
      const audio = audioRef.current!;
      const now = audio.currentTime;

      // bg
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, width, height);

      // title
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "40px Montserrat, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Lyric Clip", width / 2, 110);

      // find current/next line
      const idx = entries.findIndex((e) => now >= e.time && now < e.endTime);
      const current = idx >= 0 ? entries[idx] : null;
      const next = idx >= 0 ? entries[idx + 1] : null;

      const margin = 120;
      const y = height / 2;

      // current line block
      ctx.fillStyle = "#111827";
      ctx.fillRect(margin, y - 100, width - margin * 2, 200);

      if (current) {
        const dur = Math.max(0.05, current.endTime - current.time);
        const p = Math.min(1, Math.max(0, (now - current.time) / dur));

        // progress bar
        ctx.fillStyle = "#22c55e";
        ctx.fillRect(margin, y + 60, (width - margin * 2) * p, 8);

        // current text (wrapped)
        const lines = wrapText(
          current.text || " ",
          width - margin * 2 - 60,
          64
        );
        let baseY = y - (lines.length - 1) * 40;
        for (const line of lines) {
          // outline/glow pass
          ctx.shadowColor = "rgba(34,197,94,0.65)";
          ctx.shadowBlur = 14;
          ctx.fillStyle = "#22c55e";
          ctx.fillText(line, width / 2, baseY);
          // solid pass
          ctx.shadowBlur = 0;
          ctx.fillStyle = "#ffffff";
          ctx.fillText(line, width / 2, baseY);
          baseY += 80;
        }
      } else {
        ctx.fillStyle = "#6B7280";
        ctx.font = "bold 64px Montserrat, system-ui, sans-serif";
        ctx.fillText("…", width / 2, y);
      }

      // next line (smaller)
      if (next) {
        ctx.font = "36px Montserrat, system-ui, sans-serif";
        ctx.fillStyle = "#A3A3A3";
        const nextLines = wrapText(
          next.text || " ",
          width - margin * 2 - 60,
          36
        );
        let ny = y + 150;
        for (const line of nextLines.slice(0, 2)) {
          ctx.fillText(line, width / 2, ny);
          ny += 48;
        }
      }

      raf = requestAnimationFrame(drawFrame);
    }

    raf = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(raf);
  }, [entries, width, height]);

  const startRecording = async () => {
    if (isRecording) return;
    setIsRecording(true);

    const canvas = canvasRef.current!;
    const audio = audioRef.current!;
    await waitFonts();

    // Prepare media streams
    const vStream = canvas.captureStream(fps);
    // Audio from element
    let aStream: MediaStream;
    const anyAudio: any = audio;
    if (anyAudio.captureStream) {
      aStream = anyAudio.captureStream();
    } else if (anyAudio.mozCaptureStream) {
      aStream = anyAudio.mozCaptureStream();
    } else {
      // Web Audio fallback
      const actx = new AudioContext();
      const src = actx.createMediaElementSource(audio);
      const dest = actx.createMediaStreamDestination();
      src.connect(dest);
      src.connect(actx.destination);
      aStream = dest.stream;
    }

    const mixed = new MediaStream([
      ...vStream.getVideoTracks(),
      ...aStream.getAudioTracks(),
    ]);

    const mimeType = pickMime();
    chunksRef.current = [];
    const rec = mimeType
      ? new MediaRecorder(mixed, { mimeType })
      : new MediaRecorder(mixed);
    recorderRef.current = rec;

    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onerror = (e) => {
      console.error("MediaRecorder error:", (e as any).error || e);
      try {
        if (rec.state === "recording") rec.stop();
      } catch {}
      setIsRecording(false);
    };
    rec.onstop = () => {
      const finalMime = rec.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunksRef.current, { type: finalMime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileBaseName}.${extFromMime(finalMime)}`;
      a.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };

    // Seek & go
    if (audio.readyState < 1) {
      await new Promise<void>((res) =>
        audio.addEventListener("loadedmetadata", () => res(), { once: true })
      );
    }
    audio.currentTime = startTime;
    await audio.play();

    rec.start();

    // Stop neatly
    setTimeout(() => {
      try {
        rec.stop();
      } catch {}
      try {
        audio.pause();
      } catch {}
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
      {/*<audio
        ref={audioRef}
        src={audioSrc}
        preload="auto"
        crossOrigin="anonymous"
        style={{ display: "none" }}
      />*/}
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
        {isRecording ? "Recording…" : `Record ${durationSec}s clip`}
      </button>
    </div>
  );
};

export default CanvasLyricRecorder;
