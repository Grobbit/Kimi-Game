"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/lib/settings";
import { useUI } from "@/lib/ui";
import { executeCommand, runDirector } from "@/lib/directorClient";

type Msg = {
  id: number;
  role: "user" | "dir" | "sys" | "err";
  text: string;
  meta?: string;
};

let mid = 1;

export default function Chat() {
  const settings = useSettings();
  const open = useUI((s) => s.chat);
  const setOpen = useUI((s) => s.setChat);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      id: mid++,
      role: "sys",
      text: "Type anything. “Put me on a mountain.” “Make the car blue.”",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [ttft, setTtft] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);

  const push = (m: Omit<Msg, "id">) =>
    setMsgs((prev) => [...prev.slice(-40), { ...m, id: mid++ }]);

  useEffect(() => {
    const el = scroll.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, busy, status]);

  const cap = settings.budgetUsd;
  const pct = cap > 0 ? Math.min(1, settings.spentUsd / cap) : 0;
  const budgetHit = cap > 0 && settings.spentUsd >= cap;

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    push({ role: "user", text });

    if (budgetHit && !settings.demo) {
      push({
        role: "err",
        text: `Spend cap reached ($${cap.toFixed(2)}). Raise it in settings to keep directing.`,
      });
      return;
    }

    setBusy(true);
    setStatus("directing");
    setTtft(null);
    const applied: string[] = [];

    try {
      const ctrl = new AbortController();
      abort.current = ctrl;
      const run = await runDirector({
        message: text,
        settings,
        signal: ctrl.signal,
        onFirstByte: () => setStatus("streaming"),
        onCommand: (cmd) => {
          const label = executeCommand(cmd);
          if (label) {
            applied.push(label);
            setStatus(label);
          }
        },
      });

      useSettings.getState().addSpend(run.costUsd);

      const body =
        applied.length > 0
          ? applied.join("  ·  ")
          : run.reply || "No engine switch matched that one.";
      push({
        role: "dir",
        text: body,
        meta: `${run.ttftMs}ms first token · ${run.totalMs}ms total · ${run.promptTokens}+${run.completionTokens} tok · $${run.costUsd.toFixed(5)}`,
      });
    } catch (e) {
      const err = e as Error;
      if (err.name !== "AbortError") {
        push({ role: "err", text: err.message || "Director failed." });
      }
    } finally {
      setBusy(false);
      setStatus("");
      abort.current = null;
    }
  };

  const stop = () => {
    abort.current?.abort();
    setBusy(false);
    setStatus("");
  };

  const reopenGate = () => {
    document.exitPointerLock?.();
    settings.set({ entered: false });
  };

  if (!open) {
    return (
      <div className="chat collapsed">
        <button
          className="chat-pill"
          onClick={() => setOpen(true)}
          aria-label="Open director"
        >
          <span className="spark">
            <SparkIcon />
          </span>
          Director
          <span className="badge">
            {settings.demo ? "demo" : `$${settings.spentUsd.toFixed(3)}`}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="chat">
      <div className="chat-head">
        <span className="spark">
          <SparkIcon />
        </span>
        <div>
          <div className="title">Director</div>
          <div className="model">
            {settings.demo ? "local demo" : settings.model}
          </div>
        </div>
        <span className="grow" />
        <button className="icon-btn" onClick={reopenGate} title="API key & budget" aria-label="Settings">
          <GearIcon />
        </button>
        <button
          className="icon-btn"
          onClick={() => {
            setOpen(false);
            document.exitPointerLock?.();
          }}
          title="Collapse"
          aria-label="Collapse"
        >
          <ChevronUp />
        </button>
      </div>

      <div className="chat-scroll" ref={scroll} aria-live="polite">
        {msgs.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.text}
            {m.meta && <span className="meta">{m.meta}</span>}
          </div>
        ))}
        {busy && (
          <div className="thinking">
            <i />
            <i />
            <i />
            <span style={{ marginLeft: 4 }}>
              {ttft === null && status === "directing"
                ? "thinking…"
                : status || "streaming…"}
            </span>
          </div>
        )}
      </div>

      <div className="chat-input-row">
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void send();
            }
            if (e.key === "Escape") {
              setOpen(false);
              (e.target as HTMLInputElement).blur();
            }
          }}
          onFocus={() => document.exitPointerLock?.()}
          placeholder="Describe the world…"
          autoFocus
        />
        {busy ? (
          <button className="chat-send" onClick={stop} title="Stop" aria-label="Stop">
            <StopIcon />
          </button>
        ) : (
          <button
            className="chat-send"
            onClick={() => void send()}
            disabled={!input.trim()}
            title="Send"
            aria-label="Send"
          >
            <SendIcon />
          </button>
        )}
      </div>

      <div className="chat-foot">
        <span className={budgetHit ? "bad" : pct > 0.8 ? "warn" : ""}>
          ${settings.spentUsd.toFixed(4)}
        </span>
        <div className="spend-bar">
          <i style={{ width: `${cap > 0 ? pct * 100 : 100}%` }} />
        </div>
        <span className="grow">
          {settings.demo
            ? "demo · no API calls"
            : cap > 0
              ? `cap $${cap.toFixed(2)}`
              : "unlimited"}
        </span>
        <span>↵ to direct</span>
      </div>
    </div>
  );
}

function SparkIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0l1.6 4.6L14 6l-4.4 1.4L8 12 6.4 7.4 2 6l4.4-1.4L8 0z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
      <path
        d="M3.2 8h9.6M8.6 3.9L12.8 8l-4.2 4.1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
      <rect x="2" y="2" width="8" height="8" rx="1.6" />
    </svg>
  );
}

function ChevronUp() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 10l4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.1" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.3 3.3l1.1 1.1M11.6 11.6l1.1 1.1M3.3 12.7l1.1-1.1M11.6 4.4l1.1-1.1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}
