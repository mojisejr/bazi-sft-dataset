import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";
import {
  applyFormFieldChange,
  createDefaultFormState,
  type FormState,
  type SubmissionState,
} from "@/lib/bazi/trainer-workspace";

export type BaziWorkspaceSessionState = {
  formState: FormState;
  submittedInput: RawInputValue | null;
  calculatedState: CalculatedStateValue | null;
  submissionState: SubmissionState;
  errorMessage: string | null;
};

type BaziWorkspaceSessionStoreState = BaziWorkspaceSessionState & {
  updateFormField: (name: string, value: string) => void;
  setSubmissionState: (submissionState: SubmissionState) => void;
  setErrorMessage: (errorMessage: string | null) => void;
  applyCalculationResult: (input: {
    submittedInput: RawInputValue;
    calculatedState: CalculatedStateValue;
  }) => void;
  resetSession: () => void;
};

export function createBaziWorkspaceSessionState(
  overrides: Partial<BaziWorkspaceSessionState> = {},
): BaziWorkspaceSessionState {
  return {
    formState: createDefaultFormState(),
    submittedInput: null,
    calculatedState: null,
    submissionState: "idle",
    errorMessage: null,
    ...overrides,
  };
}

export function createBaziWorkspaceSessionStore(
  initialState: Partial<BaziWorkspaceSessionState> = {},
) {
  return createStore<BaziWorkspaceSessionStoreState>((set) => ({
    ...createBaziWorkspaceSessionState(initialState),
    updateFormField: (name, value) => {
      set((current) => ({
        formState: applyFormFieldChange(current.formState, name, value),
      }));
    },
    setSubmissionState: (submissionState) => {
      set({ submissionState });
    },
    setErrorMessage: (errorMessage) => {
      set({ errorMessage });
    },
    applyCalculationResult: ({ submittedInput, calculatedState }) => {
      set({
        submittedInput,
        calculatedState,
        submissionState: "ready",
        errorMessage: null,
      });
    },
    resetSession: () => {
      set(createBaziWorkspaceSessionState());
    },
  }));
}

const baziWorkspaceSessionStore = createBaziWorkspaceSessionStore();

export function useBaziWorkspaceSessionStore<Selected>(
  selector: (state: BaziWorkspaceSessionStoreState) => Selected,
) {
  return useStore(baziWorkspaceSessionStore, selector);
}

export function getBaziWorkspaceSessionState(): BaziWorkspaceSessionState {
  const {
    formState,
    submittedInput,
    calculatedState,
    submissionState,
    errorMessage,
  } = baziWorkspaceSessionStore.getState();

  return {
    formState,
    submittedInput,
    calculatedState,
    submissionState,
    errorMessage,
  };
}

export function seedBaziWorkspaceSession(
  input: Partial<BaziWorkspaceSessionState>,
) {
  baziWorkspaceSessionStore.setState({
    ...baziWorkspaceSessionStore.getState(),
    ...input,
  });
}

export function resetBaziWorkspaceSession() {
  baziWorkspaceSessionStore.getState().resetSession();
}
