"use client";

import React, { FC, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faHeadphones } from "@fortawesome/free-solid-svg-icons";

interface AudioDropzoneProps {
  onSelect: (file: File) => void;
  maxSizeMB?: number;
  accept?: string;
}

const AudioDropzone: FC<AudioDropzoneProps> = ({
  onSelect,
  maxSizeMB = 10,
  accept = "audio/*",
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);

  const maxBytes = maxSizeMB * 1024 * 1024;

  const pickFile = () => inputRef.current?.click();

  const validateAndSend = (file: File | null) => {
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("audio/")) {
      setError("Please select an audio file.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`Max size is ${maxSizeMB} MB.`);
      return;
    }

    setFileLabel(`${file.name} • ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    onSelect(file);
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndSend(e.target.files?.[0] ?? null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    validateAndSend(e.dataTransfer.files?.[0] ?? null);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div className="my-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload audio file"
        onClick={pickFile}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && pickFile()}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "border border-dashed border-white/20 rounded-2xl p-6",
          "flex flex-col items-center gap-2 cursor-pointer select-none",
          "transition-colors duration-150 ease-out",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400/60",
          isDragging ? "bg-white/10" : "bg-white/5",
        ].join(" ")}
      >
        <div className="w-12 h-12 rounded-full border border-white/20 grid place-items-center">
          <FontAwesomeIcon icon={faHeadphones} className="text-white" />
        </div>

        <div className="text-white font-semibold text-lg">Upload audio</div>
        <div className="text-slate-400 text-sm text-center">
          Drag & drop or click to browse (max. {maxSizeMB}MB)
        </div>

        {fileLabel && (
          <div className="mt-1.5 text-green-200 text-xs">
            Selected: {fileLabel}
          </div>
        )}
        {error && <div className="mt-1.5 text-red-300 text-xs">{error}</div>}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
};

export default AudioDropzone;
