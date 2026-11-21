"use client";

import { CommandStream } from "./incremental";
import { DIRECTOR_SYSTEM } from "./directorPrompt";
import { demoDirector } from "./demoDirector";
import { snapshot, useWorld } from "./store";
import { costOf, type Settings, useSettings } from "./settings";
import { sanitizeKey } from "./providers";

export interface DirectorRun {
  commands: number;
  promptTokens: number;
  completionTokens: number;
  ttftMs: number;
  totalMs: number;
  costUsd: number;
  reply: string;
  /** Which host/model actually served this run. */
  provider?: string;
  model?: string;
}

interface RunOpts {
  message: string;
  settings: Settings;
  onCommand: (cmd: Record<string, unknown>) => void;
  signal?: AbortSignal;
  onFirstByte?: () => void;
}

export async function runDirector(opts: RunOpts): Promise<DirectorRun> {
  if (opts.settings.demo) {
    return runDemo(opts);
  }

  const t0 = performance.now();
  const stream = new CommandStream();
  let commands = 0;
  let ttftMs = 0;
  let raw = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const state = snapshot();
  const key = sanitizeKey(opts.settings.apiKey);
  const res = await fetch("/api/director", {
    method: "POST",
    signal: opts.signal,
    headers: {
      "Content-Type": "application/json",
      ...(key ? { "x-api-key": key } : {}),
    },
    body: JSON.stringify({
      message: opts.message,
      state,
      provider: opts.settings.provider || "auto",
      model: opts.settings.model.trim() || undefined,
      baseUrl: opts.settings.baseUrl.trim() || undefined,
    }),
  });

  if (!res.ok) {
    let msg = `Director request failed (${res.status})`;
    try {
      const j = await res.json();
      if (typeof j?.error === "string") msg = j.error;
    } catch {
      /* noop */
    }
    throw new Error(msg);
  }

  // Remember which host answered, so the next sentence skips discovery.
  const usedProvider = res.headers.get("x-director-provider") || "";
  const usedModel = res.headers.get("x-director-model") || "";
  const usedBase = res.headers.get("x-director-base") || "";
  if (usedProvider && usedProvider !== "custom") {
    const cur = useSettings.getState();
    const patch: Partial<Settings> = {};
    if (cur.provider !== usedProvider) patch.provider = usedProvider;
    if (usedModel && cur.model !== usedModel) patch.model = usedModel;
    if (usedBase && cur.baseUrl !== usedBase) patch.baseUrl = usedBase;
    if (Object.keys(patch).length) cur.set(patch);
  }

  const ctype = res.headers.get("content-type") ?? "";

  if (ctype.includes("application/json")) {
    const j = await res.json();
    raw = j?.choices?.[0]?.message?.content ?? "";
    promptTokens = j?.usage?.prompt_tokens ?? 0;
    completionTokens = j?.usage?.completion_tokens ?? 0;
    opts.onFirstByte?.();
    ttftMs = performance.now() - t0;
    for (const cmd of stream.push(raw)) {
      commands++;
      opts.onCommand(cmd);
    }
    for (const cmd of stream.finalize()) {
      commands++;
      opts.onCommand(cmd);
    }
  } else if (res.body) {
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buffer = "";

    const handleLine = (line: string) => {
      if (!line.startsWith("data:")) return;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") return;
      let j: any;
      try {
        j = JSON.parse(data);
      } catch {
        return;
      }
      const delta: string = j?.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        if (!ttftMs) {
          ttftMs = performance.now() - t0;
          opts.onFirstByte?.();
        }
        raw += delta;
        for (const cmd of stream.push(delta)) {
          commands++;
          opts.onCommand(cmd);
        }
      }
      if (j?.usage) {
        promptTokens = j.usage.prompt_tokens ?? promptTokens;
        completionTokens = j.usage.completion_tokens ?? completionTokens;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += dec.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) handleLine(line);
      }
    }
    if (buffer.trim()) handleLine(buffer.trim());

    for (const cmd of stream.finalize()) {
      commands++;
      opts.onCommand(cmd);
    }
  } else {
    throw new Error("Empty response from director");
  }

  const totalMs = performance.now() - t0;

  // Rough token accounting if the provider did not report usage.
  if (!promptTokens) {
    promptTokens = Math.ceil(
      (DIRECTOR_SYSTEM.length + opts.message.length + JSON.stringify(state).length) /
        4,
    );
  }
  if (!completionTokens) {
    completionTokens = Math.max(1, Math.ceil(raw.length / 4));
  }

  return {
    commands,
    promptTokens,
    completionTokens,
    ttftMs: Math.round(ttftMs),
    totalMs: Math.round(totalMs),
    costUsd: costOf(
      promptTokens,
      completionTokens,
      opts.settings.priceIn,
      opts.settings.priceOut,
    ),
    reply: "",
    provider: usedProvider || undefined,
    model: usedModel || undefined,
  };
}

async function runDemo(opts: RunOpts): Promise<DirectorRun> {
  const t0 = performance.now();
  await new Promise((r) => setTimeout(r, 180));
  const { commands, reply } = demoDirector(opts.message);
  for (const c of commands) opts.onCommand(c);
  opts.onFirstByte?.();
  const totalMs = performance.now() - t0;
  const promptTokens = Math.ceil(opts.message.length / 4) + 40;
  const completionTokens = Math.max(1, Math.ceil(JSON.stringify(commands).length / 4));
  return {
    commands: commands.length,
    promptTokens,
    completionTokens,
    ttftMs: Math.round(totalMs * 0.7),
    totalMs: Math.round(totalMs),
    costUsd: costOf(promptTokens, completionTokens, opts.settings.priceIn, opts.settings.priceOut),
    reply,
  };
}

/** Small helper the chat uses to log command results. */
export function executeCommand(cmd: Record<string, unknown>) {
  return useWorld.getState().apply(cmd);
}
