interface LRC {
  time: number;
  endTime: number;
  text: string;
}

export const parseLRC  = (lrcText: string) => {
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
    .filter(Boolean);

  for (let i = 0; i < rows.length; i++) {
    (rows[i] as any).endTime = rows[i + 1]?.time ?? Number.POSITIVE_INFINITY;
  }
  return rows as LRC[];
}

// ---------- helpers ----------
export const pickMime = () => {
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


export const extFromMime = (m: string) => (m.includes("mp4") ? "mp4" : "webm");

export const waitFonts = async () => {
  const fonts: any = (document as any).fonts;
  if (fonts?.ready) {
    try {
      await fonts.ready;
    } catch {}
  }
}
