"use client";

import React, { FC, useEffect, useRef, useState } from "react";
import Button from "./Button";

// just for testing purposes
const initLyrics = `
[00:06.00] When you’re gonna stop breaking my heart?
[00:14.00] I don’t wanna be another one
[00:21.00] Paying for the things I never done
[00:28.00] Don’t let go, don’t let go to my love
[00:48.00] Can I get to your soul?
[00:50.00] Can you get to my thought?
[00:52.00] Can we promise we won’t let go?
[00:55.00] All the things that I need
[00:57.00] All the things that you need
[00:59.00] You can make it feel so real
[01:03.00] ’Cause you can’t deny, you’ve blown my mind
[01:08.00] When I touch your body
[01:09.00] I feel I’m losing control
[01:10.00] ’Cause you can’t deny, you’ve blown my mind`;

// Basic LRC line pattern: [mm:ss.xx] text
const linePattern = /^\s*\[\d{2}:\d{2}\.\d{2}\]\s.+$/;

/**
 * LyricsModal
 * A lightweight, accessible modal with a textarea for pasting time-tagged lyrics (LRC-style).
 *
 * Props:
 *  - open: boolean — controls visibility
 *  - onClose: () => void — called when closing (overlay, ESC, Cancel)
 *  - onSave?: (value: string) => void — called with textarea value on Save
 *  - initialValue?: string — optional initial textarea content
 */

interface LyricsModalProps {
  open: boolean;
  onClose: () => void;
  onSave?: (value: string) => void;
  initialValue?: string;
}

const LyricsModal: FC<LyricsModalProps> = ({
  open,
  onClose,
  onSave,
  initialValue = "",
}) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      // small delay so it's mounted before focusing
      const id = setTimeout(() => {
        textRef.current?.focus();
      }, 0);
      return () => clearTimeout(id);
    }
  }, [open]);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const placeholder = `[00:14.00] Yes, I can see her\n[00:16.00] 'Cause every girl in here wanna be her  \n[00:21.00] Oh, she's a diva  \n[00:24.00] I feel the same and I wanna meet her  \n[00:29.00] They say she low-down  \n[00:31.00] It's just a rumor and I don't believe 'em  \n[00:36.00] They say she needs to slow down  \n[00:39.00] The baddest thing around town  \n[00:43.00] She's nothing like a girl you've ever seen before  \n[00:47.00] Nothing you can compare to your neighborhood ho  \n[00:50.00] I'm tryna find the words to describe this girl without being disrespectful`;

  const lines = value.split(/\r?\n/).filter((l) => l.length > 0);
  const invalidLines = lines.filter((l) => !linePattern.test(l));
  const isValid = value.trim().length === 0 || invalidLines.length === 0;

  if (!open) return null;

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        ref={dialogRef}
        className="relative z-10 w-[min(92vw,800px)] max-h-[90vh] rounded-2xl bg-white p-5 shadow-2xl dark:bg-neutral-900"
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold">Paste time‑tagged lyrics</h2>
          <button
            onClick={onClose}
            className="rounded-xl px-3 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <p className="mb-3 text-sm text-neutral-600 dark:text-neutral-300">
          Use the format <code>[mm:ss.xx] your lyric line</code>. Each line must
          start with a timestamp in square brackets. The placeholder shows the
          expected format.
        </p>

        <textarea
          ref={textRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          spellCheck={false}
          className="h-64 w-full resize-y rounded-xl border border-neutral-300 bg-white p-3 font-mono text-sm leading-6 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-300 dark:border-neutral-700 dark:bg-neutral-950"
        />

        <div className="mt-2 min-h-[1.5rem] text-sm">
          {!isValid && (
            <div className="rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {invalidLines.length} line{invalidLines.length === 1 ? "" : "s"}{" "}
              don’t match
              <code className="ml-1">[mm:ss.xx] your lyric line</code>
            </div>
          )}
          {touched && value.trim().length === 0 && (
            <div className="text-neutral-500">
              Tip: paste your lyrics or start typing using the placeholder
              format.
            </div>
          )}
        </div>

        <footer className="mt-4 flex items-center justify-end gap-2">
          <Button type="button" onClick={onClose} variant="ternary">
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave?.(value);
            }}
            disabled={!isValid || value.trim().length === 0}
            variant="primary"
          >
            Save
          </Button>
        </footer>
      </div>
    </div>
  );
};

export default LyricsModal;
