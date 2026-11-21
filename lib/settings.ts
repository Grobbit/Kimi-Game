import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface Settings {
  apiKey: string;
  /** "auto" = let the route figure out which host owns this key. */
  provider: string;
  model: string;
  baseUrl: string;
  /** 0 = unlimited */
  budgetUsd: number;
  spentUsd: number;
  priceIn: number; // USD per 1M input tokens
  priceOut: number; // USD per 1M output tokens
  demo: boolean;
  entered: boolean;
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void;
  addSpend: (usd: number) => void;
  resetSpend: () => void;
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKey: "",
      provider: "auto",
      model: "kimi-k3.1-pro",
      baseUrl: "https://api.cerebras.ai/v1",
      budgetUsd: 0,
      spentUsd: 0,
      priceIn: 0.35,
      priceOut: 1.2,
      demo: false,
      entered: false,
      set: (patch) => set(patch),
      addSpend: (usd) =>
        set((s) => ({ spentUsd: Math.round((s.spentUsd + usd) * 1e6) / 1e6 })),
      resetSpend: () => set({ spentUsd: 0 }),
    }),
    {
      name: "kimi-game-settings-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        apiKey: s.apiKey,
        provider: s.provider,
        model: s.model,
        baseUrl: s.baseUrl,
        budgetUsd: s.budgetUsd,
        spentUsd: s.spentUsd,
        priceIn: s.priceIn,
        priceOut: s.priceOut,
        demo: s.demo,
      }),
    },
  ),
);

export function costOf(
  promptTokens: number,
  completionTokens: number,
  priceIn = 0.35,
  priceOut = 1.2,
): number {
  return (
    (promptTokens / 1_000_000) * priceIn +
    (completionTokens / 1_000_000) * priceOut
  );
}
