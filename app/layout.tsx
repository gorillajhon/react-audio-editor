export const metadata = {
  title: 'Audio → Lyrics Video',
  description: 'Upload, cut, transcribe, subtitle, and render a lyrics video (SRT + LRC).'
};

import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
