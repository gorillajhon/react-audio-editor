import { ReactNode } from "react";

import "./globals.css";

export const metadata = {
  title: "Audio → Lyrics Video",
  description:
    "Upload, cut, transcribe, subtitle, and render a lyrics video (SRT + LRC).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
