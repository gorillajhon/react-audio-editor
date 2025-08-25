import React from "react";

import ReproducerContainer from "./components/ReproducerContainer";

export default function Home() {
  return (
    <main className="container">
      <h1 className="text-2xl font-semibold mb-2">Audio → Lyrics Video ♫</h1>
      <ReproducerContainer />
    </main>
  );
}
