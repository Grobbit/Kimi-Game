"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui";

export default function Boot() {
  const booted = useUI((s) => s.booted);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!booted) return;
    const t = setTimeout(() => setGone(true), 1100);
    return () => clearTimeout(t);
  }, [booted]);

  if (gone) return null;

  return (
    <div className={`boot ${booted ? "hide" : ""}`}>
      <div>
        Building the world
        <div className="bar">
          <i />
        </div>
      </div>
    </div>
  );
}
