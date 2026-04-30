import { describe, expect, test } from "vitest";

import {
  createBaziWorkspaceSessionState,
  createBaziWorkspaceSessionStore,
} from "@/lib/bazi/bazi-session-store";
import type { CalculatedStateValue, RawInputValue } from "@/lib/bazi/schema-types";

const stubInput = {
  birthDate: "1981-03-17",
  birthTime: "10:22",
  gender: "male",
  province: "สมุทรสาคร",
} satisfies RawInputValue;

const stubCalculatedState = {
  dayMaster: "己",
} as unknown as CalculatedStateValue;

describe("bazi-session-store", () => {
  test("starts with a pristine workspace session", () => {
    const state = createBaziWorkspaceSessionState();

    expect(state.formState.birthDay).toBe("");
    expect(state.submittedInput).toBeNull();
    expect(state.calculatedState).toBeNull();
    expect(state.submissionState).toBe("idle");
    expect(state.errorMessage).toBeNull();
  });

  test("updates form state through the shared store action", () => {
    const store = createBaziWorkspaceSessionStore();

    store.getState().updateFormField("birthMonth", "2");
    store.getState().updateFormField("birthYearBe", "2524");
    store.getState().updateFormField("birthDay", "17");

    expect(store.getState().formState.birthMonth).toBe("2");
    expect(store.getState().formState.birthYearBe).toBe("2524");
    expect(store.getState().formState.birthDay).toBe("17");
  });

  test("stores submitted input and calculated state as one shared session", () => {
    const store = createBaziWorkspaceSessionStore();

    store.getState().setSubmissionState("submitting");
    store.getState().applyCalculationResult({
      submittedInput: stubInput,
      calculatedState: stubCalculatedState,
    });

    expect(store.getState().submittedInput).toEqual(stubInput);
    expect(store.getState().calculatedState).toBe(stubCalculatedState);
    expect(store.getState().submissionState).toBe("ready");
    expect(store.getState().errorMessage).toBeNull();
  });

  test("reset clears the whole shared workspace session", () => {
    const store = createBaziWorkspaceSessionStore();

    store.getState().updateFormField("birthDay", "17");
    store.getState().setSubmissionState("error");
    store.getState().setErrorMessage("boom");
    store.getState().applyCalculationResult({
      submittedInput: stubInput,
      calculatedState: stubCalculatedState,
    });

    store.getState().resetSession();

    expect(store.getState().formState.birthDay).toBe("");
    expect(store.getState().submittedInput).toBeNull();
    expect(store.getState().calculatedState).toBeNull();
    expect(store.getState().submissionState).toBe("idle");
    expect(store.getState().errorMessage).toBeNull();
  });
});