"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { ColorResult } from "@uiw/react-color";
import { extFromMime, parseLRC, pickMime, waitFonts } from "./utils";
import ColorPicker from "@components/ColorPicker";
import Button from "@components/Button";
import CheckBox from "@components/CheckBox";

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
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioRef = externalAudioRef || internalAudioRef;

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [isRecording, setIsRecording] = useState(false);

  const entries = useMemo(() => parseLRC(lrcText), [lrcText]);

  const [lyricsConfig, setLyricsConfig] = useState({
    background: "#0b1220",
    color: "#ffffff",
    nextLineColor: "#6b7280",
    hasNextLineLyric: false,
    hasProgressBar: false,
    progressBarColor: "#22c55e",
  });

  const [backgroundColorToggle, setBackgroundColorToggle] = useState(false);
  const [lyricsColorToggle, setLyricsColorToggle] = useState(false);
  const [nextLineColorToggle, setNextLineColorToggle] = useState(false);
  const [progressBarColorToggle, setProgressBarColorToggle] = useState(false);

  const handleChangeLyricsBackground = ({ hex }: ColorResult) => {
    setLyricsConfig((prev) => ({ ...prev, background: hex }));
  };

  const handleChangeLyricsColor = ({ hex }: ColorResult) => {
    setLyricsConfig((prev) => ({ ...prev, color: hex }));
  };

  const handleChangeProgressBarColor = ({ hex }: ColorResult) => {
    setLyricsConfig((prev) => ({ ...prev, progressBarColor: hex }));
  };

  const handleChangeNextLineColor = ({ hex }: ColorResult) => {
    setLyricsConfig((prev) => ({ ...prev, nextLineColor: hex }));
  };

  const handleToggleType = (
    type: "background" | "lyrics" | "nextLine" | "progressBar"
  ) => {
    switch (type) {
      case "background":
        setBackgroundColorToggle((prev) => !prev);
        setLyricsColorToggle(false);
        setNextLineColorToggle(false);
        setProgressBarColorToggle(false);
        break;
      case "lyrics":
        setLyricsColorToggle((prev) => !prev);
        setBackgroundColorToggle(false);
        setNextLineColorToggle(false);
        setProgressBarColorToggle(false);
        break;
      case "nextLine":
        setNextLineColorToggle((prev) => !prev);
        setLyricsColorToggle(false);
        setBackgroundColorToggle(false);
        setProgressBarColorToggle(false);
        break;
      case "progressBar":
        setProgressBarColorToggle((prev) => !prev);
        setNextLineColorToggle(false);
        setLyricsColorToggle(false);
        setBackgroundColorToggle(false);
        break;
    }
  };

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
      ctx.fillStyle = lyricsConfig.background;
      ctx.fillRect(0, 0, width, height);

      // title
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "40px Montserrat, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("", width / 2, 110);

      // find current/next line
      const idx = entries.findIndex((e) => now >= e.time && now < e.endTime);
      const current = idx >= 0 ? entries[idx] : null;
      const next = idx >= 0 ? entries[idx + 1] : null;

      const margin = 120;
      const y = height / 2;

      // current line block
      ctx.fillStyle = lyricsConfig.background;
      ctx.fillRect(margin, y - 100, width - margin * 2, 200);

      if (current) {
        const dur = Math.max(0.05, current.endTime - current.time);
        const p = Math.min(1, Math.max(0, (now - current.time) / dur));

        // progress bar
        // #22c55e
        if (lyricsConfig.hasProgressBar && lyricsConfig.progressBarColor) {
          ctx.fillStyle = lyricsConfig.progressBarColor;
        }

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
          //ctx.shadowColor = "rgba(34,197,94,0.65)";
          //ctx.shadowBlur = 14;
          //ctx.fillStyle = "#22c55e";
          ctx.fillText(line, width / 2, baseY);
          // solid pass
          ctx.shadowBlur = 0;
          ctx.fillStyle = lyricsConfig.color;
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
        ctx.fillStyle = lyricsConfig.background;
        if (lyricsConfig.hasNextLineLyric) {
          ctx.fillStyle = lyricsConfig.nextLineColor;
        }

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
  }, [entries, width, height, lyricsConfig]);

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
    rec.onerror = () => {
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

  const handleCheckEnableProgressBar = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const isChecked = e.target.checked;
    setLyricsConfig((prev) => ({ ...prev, hasProgressBar: isChecked }));
  };

  const handleCheckEnableNextLine = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const isChecked = e.target.checked;
    setLyricsConfig((prev) => ({ ...prev, hasNextLineLyric: isChecked }));
  };

  return (
    <div className="w-full flex flex-col items-center gap-3">
      <div className="flex flex-row gap-9">
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
        {/* Controls */}
        <div className="flex flex-col gap-3">
          <Button
            variant="secondary"
            key="lyrics-background-picker"
            onClick={() => {
              handleToggleType("background");
            }}
          >
            | Background lyrics color
          </Button>
          {backgroundColorToggle && (
            <ColorPicker
              onChange={handleChangeLyricsBackground}
              defaultHexColor={lyricsConfig.background}
            />
          )}

          <Button
            variant="secondary"
            key="lyrics-color-picker"
            onClick={() => {
              handleToggleType("lyrics");
            }}
          >
            Lyrics color
          </Button>
          {lyricsColorToggle && (
            <ColorPicker
              onChange={handleChangeLyricsColor}
              defaultHexColor={lyricsConfig.color}
            />
          )}

          <div className="flex flex-col gap-5 border border-dashed border-white/20 p-4 rounded">
            <CheckBox
              label="Enable progress bar in lyricis video"
              id="progress_bar"
              onChange={handleCheckEnableProgressBar}
            />
            {lyricsConfig.hasProgressBar && (
              <>
                <Button
                  variant="secondary"
                  key="lyrics-progressbar-color"
                  onClick={() => {
                    handleToggleType("progressBar");
                  }}
                >
                  Background progressbar color
                </Button>
                {progressBarColorToggle && (
                  <ColorPicker
                    onChange={handleChangeProgressBarColor}
                    defaultHexColor={lyricsConfig.progressBarColor}
                  />
                )}
              </>
            )}
          </div>
          <div className="flex flex-col gap-5 border border-dashed border-white/20 p-4 rounded">
            <CheckBox
              label="Enable next line lyrics video"
              id="next_line_lyrics"
              onChange={handleCheckEnableNextLine}
            />
            {lyricsConfig.hasNextLineLyric && (
              <>
                <Button
                  variant="secondary"
                  key="lyrics-nextline-color"
                  onClick={() => {
                    handleToggleType("nextLine");
                  }}
                >
                  Next lyrics color
                </Button>
                {nextLineColorToggle && (
                  <ColorPicker
                    onChange={handleChangeNextLineColor}
                    defaultHexColor={lyricsConfig.nextLineColor}
                  />
                )}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3"></div>
      </div>
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
