"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
// @ts-ignore
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

import LyricsModal from "@components/LyricsModal";
//import LyricsText from "./LyricsText";
import AudioDropzone from "@components/AudioDropzone";
import Button from "@components/Button";
//import LyricClipper from "@components/LyricClipper";
import DivRecorder from "@components/DivRecorder";

const fmt = (t: number) => {
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${String(m).padStart(2, "0")}:${s.toFixed(2).padStart(5, "0")}`;
};

// call after you create your region:
const setLabel = (r: any) => {
  const len = Math.max(0, (r.end ?? 0) - (r.start ?? 0));
  r.setOptions({ content: fmt(len) });
};

const ReproducerContainer = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [cutUrl, setCutUrl] = useState<string | null>(null);
  const [lyrcisTextKey, setLyricsTextKey] = useState("lyrics_text");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionRef = useRef<any>(null);

  // NEW: shared audio element used by BOTH WaveSurfer and RabbitLyrics
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [lyricText, setLyricsText] = useState("");
  const [isLyricModalOpen, setIsLyricModalOpen] = useState(false);

  const [start, setStart] = useState(0);
  const [duration, setDuration] = useState(60);
  const end = useMemo(() => start + duration, [start, duration]);

  useEffect(() => {
    if (!containerRef.current || !audioRef.current || !audioUrl) return;

    audioRef.current.src = audioUrl;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef.current, // <- uses your <audio> element
      waveColor: "#6b7280",
      progressColor: "#22c55e",
      cursorColor: "#fff",
      height: 96,
      interact: true,
    });
    wsRef.current = ws;

    // Enable drag-to-select (user can create/replace the region by dragging)
    const regions = ws.registerPlugin(
      RegionsPlugin.create({
        dragSelection: { slop: 5 },
      })
    );

    regions.on("region-updated", (r) => setLabel(r));

    // Keep only ONE region at a time
    regions.on("region-created", (r) => {
      if (regionRef.current && r.id !== regionRef.current.id) {
        regionRef.current.remove();
      }
      regionRef.current = r;
      r.on?.("update-end", () => setLabel(r));
    });

    ws.on("ready", () => {
      // Create a default 30s region (shorter if track < 30s)
      const dur = ws.getDuration();
      const end = Math.min(30, dur);
      regionRef.current = regions.addRegion({
        id: "selection",
        start: 0,
        end,
        color: "rgba(34,197,94,0.2)", // translucent green to match your progressColor
        drag: true,
        resize: true,
        loop: false, // set true if you want loop by default
      });
      setLabel(regionRef.current);
    });

    return () => {
      ws.destroy();
      wsRef.current = null;
      regionRef.current = null;
    };
  }, [audioUrl]);

  const hadleUploadAudio = (file: File) => {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    setCutUrl(null);

    setStart(0);
    setDuration(30);
  };

  const handleSaveLyrics = (lyrics: string) => {
    const newLyricTextKey = `lyrcisTextKey_${new Date().getTime()}`;
    setLyricsText(lyrics);
    setLyricsTextKey(newLyricTextKey);
    setIsLyricModalOpen(false);
  };

  const handleToggleAudioPlay = () => {
    const ws = wsRef.current;
    const r = regionRef.current;
    if (!ws) return;

    // If there's a selection, constrain playback to it
    if (r) {
      if (ws.isPlaying()) {
        ws.pause();
        return;
      }

      // 1) snap into the selection
      ws.setTime(r.start);

      // 2) if you want looping, use playLoop(), else normal play + guard
      const loop = !!r.getOptions?.().loop;
      if (loop && typeof r.playLoop === "function") {
        r.playLoop();
        return;
      }

      // 3) play once and auto-stop at region end
      ws.play();

      // one-shot guard to stop at region end
      const stopAtEnd = (t: number) => {
        if (t >= r.end) {
          ws.pause();
          ws.setTime(r.end); // keep cursor at the end of the selection
          ws.un("audioprocess", stopAtEnd);
        }
      };
      ws.on("audioprocess", stopAtEnd);
      return;
    }

    // No selection: normal toggle
    ws.isPlaying() ? ws.pause() : ws.play();
  };

  return (
    <>
      <LyricsModal
        open={isLyricModalOpen}
        onClose={() => setIsLyricModalOpen(false)}
        onSave={handleSaveLyrics}
      />

      <AudioDropzone
        onSelect={hadleUploadAudio}
        maxSizeMB={10}
        accept="audio/mp3,audio/mpeg,audio/*"
      />

      {audioUrl && (
        <div className="card mb-5">
          <div className="row">
            <Button
              variant="secondary"
              disabled={!audioUrl}
              onClick={handleToggleAudioPlay}
            >
              Play / Pause
            </Button>
            {audioUrl && (
              <Button
                variant="primary"
                onClick={() => setIsLyricModalOpen(true)}
              >
                Add lyrics
              </Button>
            )}
          </div>

          {/* Waveform bound to the <audio> element */}
          <div ref={containerRef} className="wave mt-5" />

          <div className="legend">
            Click/drag the waveform to seek — it’s synced with the audio.
          </div>
        </div>
      )}

      {/* Shared audio element (source of truth) */}
      {audioUrl && (
        <section className="card mb-5">
          <h2>Preview</h2>
          <audio
            controls
            ref={audioRef}
            src={cutUrl || audioUrl || undefined}
            className="w-full my-6"
            id="audio-1"
          />
        </section>
      )}

      {/* Lyrics renderer: binds to the SAME audio via mediaRef */}
      {/** Oldest one */}
      {/*lyricText && (
        <LyricsText
          lyrics={lyricText}
          mediaRef={audioRef}
          key={lyrcisTextKey}
        />
      )*/}

      {lyricText && (
        <DivRecorder
          lrcText={lyricText}
          audioRef={audioRef}
          startTime={0}
          durationSec={20}
        />
      )}
    </>
  );
};

export default ReproducerContainer;
