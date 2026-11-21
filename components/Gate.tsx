"use client";

import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useUI } from "@/lib/ui";

const CAPS = [
  { id: "unlimited", label: "Unlimited" },
  { id: "1", label: "$1" },
  { id: "5", label: "$5" },
  { id: "10", label: "$10" },
];

export default function Gate() {
  const settings = useSettings();
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [priceIn, setPriceIn] = useState(String(settings.priceIn));
  const [priceOut, setPriceOut] = useState(String(settings.priceOut));
  const [cap, setCap] = useState<string>(
    settings.budgetUsd ? "custom" : "unlimited",
  );
  const [custom, setCustom] = useState(
    settings.budgetUsd ? String(settings.budgetUsd) : "5",
  );
  const [advanced, setAdvanced] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    setApiKey(settings.apiKey);
    setModel(settings.model);
    setBaseUrl(settings.baseUrl);
  }, [settings.apiKey, settings.model, settings.baseUrl]);

  const enter = (demo: boolean) => {
    let budget = 0;
    if (cap === "custom") {
      budget = Number(custom);
      if (!Number.isFinite(budget) || budget < 0) {
        setErr("Enter a valid spend cap.");
        return;
      }
    } else if (cap !== "unlimited") {
      budget = Number(cap);
    }
    setErr("");
    settings.set({
      apiKey: apiKey.trim(),
      model: model.trim() || "kimi-k3.1-pro",
      baseUrl: baseUrl.trim() || "https://api.cerebras.ai/v1",
      priceIn: Math.max(0, Number(priceIn) || 0),
      priceOut: Math.max(0, Number(priceOut) || 0),
      budgetUsd: budget,
      demo,
      entered: true,
    });
    useUI.getState().setChat(true);
  };

  return (
    <div className="gate">
      <form
        className="gate-card"
        onSubmit={(e) => {
          e.preventDefault();
          enter(false);
        }}
      >
        <div className="gate-eyebrow">
          <span className="dot" />
          Director engine · Cerebras
        </div>

        <h1 className="gate-title">KIMI GAME</h1>
        <p className="gate-sub">
          A world you talk to. Paste your Kimi API key, set a{" "}
          <strong>spend cap</strong>, step into the field. Every sentence
          becomes a tiny command — the engine does the rest.
        </p>

        <div className="field">
          <label htmlFor="key">
            Kimi API key <span className="opt">stored in this browser only</span>
          </label>
          <input
            id="key"
            className="input mono"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="csk-••••••••••••••••••••••••"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        <div className="field">
          <label>
            Spend cap{" "}
            <span className="opt">
              {settings.spentUsd > 0
                ? `$${settings.spentUsd.toFixed(4)} used so far`
                : "your Kimi usage"}
            </span>
          </label>
          <div className="budget-row">
            {CAPS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`chip ${cap === c.id ? "active" : ""}`}
                onClick={() => setCap(c.id)}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              className={`chip ${cap === "custom" ? "active" : ""}`}
              onClick={() => setCap("custom")}
            >
              Custom
            </button>
            {cap === "custom" && (
              <input
                className="chip-custom"
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="$"
                aria-label="Custom spend cap in dollars"
              />
            )}
          </div>
        </div>

        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setAdvanced((v) => !v)}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d={advanced ? "M1 7l4-4 4 4" : "M1 3l4 4 4-4"}
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Advanced
        </button>

        {advanced && (
          <div className="advanced">
            <div className="field">
              <label htmlFor="model">Model</label>
              <input
                id="model"
                className="input mono"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="base">API base URL</label>
              <input
                id="base"
                className="input mono"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                spellCheck={false}
              />
            </div>
            <div className="field">
              <label htmlFor="pin">$ / 1M input tok</label>
              <input
                id="pin"
                className="input mono"
                value={priceIn}
                onChange={(e) => setPriceIn(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="field">
              <label htmlFor="pout">$ / 1M output tok</label>
              <input
                id="pout"
                className="input mono"
                value={priceOut}
                onChange={(e) => setPriceOut(e.target.value)}
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        {err && <div className="gate-error">{err}</div>}

        <div className="gate-actions">
          <button className="btn primary" type="submit">
            Enter world
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => enter(true)}
          >
            Demo
          </button>
        </div>

        <div className="gate-note">
          The key never ships in the bundle — it travels over HTTPS to your
          Vercel edge route, which streams Kimi back token by token. You can
          also set <kbd>CEREBRAS_API_KEY</kbd> on the server and leave the field
          empty. <kbd>Esc</kbd> releases the mouse.
        </div>
      </form>
    </div>
  );
}
