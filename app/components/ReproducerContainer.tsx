"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
// @ts-ignore
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.js";

import LyricsModal from "./LyricsModal";
import LyricsText from "./LyricsText";
import AudioDropzone from "./AudioDropzone";
import Button from "./Button";

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

    // Create WaveSurfer using the audio element as its media backend
    const ws = WaveSurfer.create({
      container: containerRef.current,
      media: audioRef.current,
      waveColor: "#6b7280",
      progressColor: "#22c55e",
      cursorColor: "#fff",
      height: 96,
      interact: true,
    });

    // (Optional) Regions plugin—keep registered even if not used now
    const regions = ws.registerPlugin(RegionsPlugin.create());
    wsRef.current = ws;

    ws.on("ready", () => {});

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
    const el = audioRef.current;
    if (!el) return;
    el.paused ? el.play() : el.pause();
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
      {lyricText && (
        <LyricsText
          lyrics={lyricText}
          mediaRef={audioRef}
          key={lyrcisTextKey}
        />
      )}
    </>
  );
};

export default ReproducerContainer;
