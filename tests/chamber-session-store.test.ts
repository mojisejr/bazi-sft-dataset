import { afterEach, describe, expect, test } from "vitest";

import {
  clearChamberSession,
  getChamberSession,
  isChamberSessionAvailable,
  seedChamberSession,
} from "@/lib/bazi/chamber-session-store";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

const stubCalculatedState = {
  dayMaster: "己",
} as unknown as CalculatedStateValue;

describe("chamber-session-store", () => {
  afterEach(() => {
    clearChamberSession();
  });

  test("starts empty", () => {
    expect(getChamberSession()).toBeNull();
    expect(isChamberSessionAvailable()).toBe(false);
  });

  test("seeds and returns the session payload", () => {
    const session = seedChamberSession({
      submittedInput: null,
      calculatedState: stubCalculatedState,
    });

    expect(session.sessionKey).toMatch(/^chamber-/);
    expect(getChamberSession()).not.toBeNull();
    expect(getChamberSession()?.calculatedState).toBe(stubCalculatedState);
    expect(isChamberSessionAvailable()).toBe(true);
  });

  test("clears the session", () => {
    seedChamberSession({ submittedInput: null, calculatedState: stubCalculatedState });
    clearChamberSession();
    expect(getChamberSession()).toBeNull();
    expect(isChamberSessionAvailable()).toBe(false);
  });

  test("respects an explicit sessionKey when provided", () => {
    const session = seedChamberSession({
      submittedInput: null,
      calculatedState: stubCalculatedState,
      sessionKey: "chamber-fixed-key",
    });

    expect(session.sessionKey).toBe("chamber-fixed-key");
  });
});
