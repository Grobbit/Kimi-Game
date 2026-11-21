"use client";

import { useEffect, useState } from "react";
import { useUI } from "@/lib/ui";
import { useWorld } from "@/lib/store";
import { VEHICLES } from "@/lib/registry";

export default function HUD() {
  const chat = useUI((s) => s.chat);
  const locked = useUI((s) => s.locked);
  const near = useUI((s) => s.near);
  const driving = useWorld((s) => s.driving);
  const vehicle = useWorld((s) => s.vehicle);
  const toast = useWorld((s) => s.toast);

  const [showToast, setShowToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    setShowToast(toast.text);
    const t = setTimeout(() => setShowToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const fly = vehicle ? VEHICLES[vehicle.kind].fly : false;

  return (
    <>
      <div className={`crosshair ${locked && !chat ? "" : "hidden"}`} />

      {!chat && locked && (
        <div className="hint">
          {driving ? (
            <>
              <span>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> Drive
              </span>
              {fly && (
                <>
                  <span className="sep" />
                  <span>
                    <kbd>↑</kbd>
                    <kbd>↓</kbd> Altitude
                  </span>
                </>
              )}
              <span className="sep" />
              <span>
                <kbd>F</kbd> Exit
              </span>
            </>
          ) : (
            <>
              <span>
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd> Move
              </span>
              <span className="sep" />
              <span>
                <kbd>Shift</kbd> Sprint
              </span>
              <span className="sep" />
              <span>
                <kbd>Space</kbd> Jump
              </span>
              <span className="sep" />
              <span>
                <kbd>F</kbd> {near ? "Get in" : "Drive"}
              </span>
            </>
          )}
        </div>
      )}

      {!chat && !locked && (
        <div className="lock-hint">
          <div>
            {driving ? "Click to take the wheel" : "Click to look around"}
          </div>
        </div>
      )}

      {showToast && <div className="toast">{showToast}</div>}
    </>
  );
}
