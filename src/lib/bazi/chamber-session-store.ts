import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

export type ChamberSession = {
  sessionKey: string;
  submittedInput: RawInputValue | null;
  calculatedState: CalculatedStateValue;
};

type ChamberSessionStoreState = {
  session: ChamberSession | null;
  seedSession: (session: ChamberSession) => void;
  clearSession: () => void;
};

function generateSessionKey() {
  return `chamber-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createChamberSessionStore() {
  return createStore<ChamberSessionStoreState>((set) => ({
    session: null,
    seedSession: (session) => {
      set({ session });
    },
    clearSession: () => {
      set({ session: null });
    },
  }));
}

const chamberSessionStore = createChamberSessionStore();

export function useChamberSessionStore<Selected>(
  selector: (state: ChamberSessionStoreState) => Selected,
) {
  return useStore(chamberSessionStore, selector);
}

export function seedChamberSession(input: {
  submittedInput: RawInputValue | null;
  calculatedState: CalculatedStateValue;
  sessionKey?: string;
}): ChamberSession {
  const session: ChamberSession = {
    sessionKey: input.sessionKey ?? generateSessionKey(),
    submittedInput: input.submittedInput,
    calculatedState: input.calculatedState,
  };

  chamberSessionStore.getState().seedSession(session);

  return session;
}

export function clearChamberSession() {
  chamberSessionStore.getState().clearSession();
}

export function getChamberSession(): ChamberSession | null {
  return chamberSessionStore.getState().session;
}

export function isChamberSessionAvailable(): boolean {
  return chamberSessionStore.getState().session !== null;
}
