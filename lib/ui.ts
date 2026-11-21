import { create } from "zustand";

interface UIState {
  chat: boolean;
  setChat: (v: boolean) => void;
  locked: boolean;
  setLocked: (v: boolean) => void;
  near: boolean;
  setNear: (v: boolean) => void;
  booted: boolean;
  setBooted: (v: boolean) => void;
}

export const useUI = create<UIState>()((set) => ({
  chat: true,
  setChat: (v) => set({ chat: v }),
  locked: false,
  setLocked: (v) => set({ locked: v }),
  near: false,
  setNear: (v) => set({ near: v }),
  booted: false,
  setBooted: (v) => set({ booted: v }),
}));
