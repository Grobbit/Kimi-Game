"use client";

import { useEffect, useState } from "react";
import Gate from "./Gate";
import Game from "./Game";
import Chat from "./Chat";
import HUD from "./HUD";
import Boot from "./Boot";
import { useSettings } from "@/lib/settings";
import { useUI } from "@/lib/ui";

export default function GameRoot() {
  const entered = useSettings((s) => s.entered);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let done = false;
    const t = setTimeout(() => {
      if (!done) setHydrated(true);
    }, 700);
    Promise.resolve(useSettings.persist.rehydrate()).finally(() => {
      done = true;
      clearTimeout(t);
      setHydrated(true);
    });
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useUI.getState().chat) {
        // Esc already releases the pointer lock; collapse the panel too.
        const el = document.activeElement as HTMLElement | null;
        if (el?.tagName === "INPUT") el.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!hydrated) return <Gate />;

  if (!entered) return <Gate />;

  return (
    <>
      <Game />
      <div className="vignette" />
      <HUD />
      <Chat />
      <Boot />
    </>
  );
}
