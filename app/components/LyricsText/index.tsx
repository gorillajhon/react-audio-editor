"use client";

import React, { FC, useEffect, useLayoutEffect, useRef } from "react";

const sanitizeLyrics = (src: string) => {
  return src
    .replace(/\r\n/g, "\n")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
};

interface LyricsTextProps {
  lyrics?: string;
  mediaRef?: React.RefObject<HTMLAudioElement>;
  audioUrl?: string;
}

const LyricsText: FC<LyricsTextProps> = ({ lyrics, mediaRef, audioUrl }) => {
  // Fallback audioRef if parent didn't pass one (kept for flexibility)
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const rabbitInstanceRef = useRef<any | null>(null);

  useEffect(() => {
    return () => {
      rabbitInstanceRef.current?.destroy?.();
      rabbitInstanceRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    if (!lyricsRef.current || !lyrics) return;

    const handleLyrics = async () => {
      // Destroy any previous instance
      rabbitInstanceRef.current?.destroy?.();
      rabbitInstanceRef.current = null;

      // Set text
      lyricsRef.current.textContent = sanitizeLyrics(lyrics);
      // Optional view mode
      lyricsRef.current.setAttribute("data-view-mode", "default");

      const { default: RabbitLyrics } = await import("rabbit-lyrics");

      // Choose which audio element to bind:
      const mediaEl =
        (mediaRef && mediaRef.current) || fallbackAudioRef.current || undefined;

      // Create instance bound to the shared <audio>
      rabbitInstanceRef.current = new RabbitLyrics(lyricsRef.current, mediaEl);

      // Basic styling
      lyricsRef.current.style.backgroundColor = "#7f2e85";
      lyricsRef.current.style.borderColor = "#7f2e85";
      lyricsRef.current.style.borderRadius = "16px";
      lyricsRef.current.style.color = "#fff";
    };

    handleLyrics();
  }, [lyrics, mediaRef?.current]);

  return (
    <section className="card mb-5">
      <h2>Lyrics</h2>

      {/* If parent did not pass mediaRef, we can render our own audio for fallback */}
      {!mediaRef && (
        <audio
          controls
          ref={fallbackAudioRef}
          src={audioUrl}
          className="w-full my-6"
          id="audio-lyrics"
        />
      )}

      <div className="rabbit-lyrics" ref={lyricsRef} />
    </section>
  );
};

export default LyricsText;
