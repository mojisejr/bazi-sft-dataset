"use client";

import { type ChangeEvent, type FormEvent } from "react";

import {
  CalculatedStateSchema,
} from "@/lib/bazi/schema-types";
import {
  buildPayload,
  createDefaultFormState,
  normalizeErrorMessage,
  type BaziTrainerWorkspaceProps,
} from "@/lib/bazi/trainer-workspace";
import {
  getBaziWorkspaceSessionState,
  seedBaziWorkspaceSession,
  useBaziWorkspaceSessionStore,
} from "@/lib/bazi/bazi-session-store";

type SubmitCalculationOptions = {
  onBeforeApplyResult?: () => void;
};

export function useBaziCalculate({
  initialFormState,
  initialSubmittedInput = null,
  initialCalculatedState = null,
  initialSubmissionState = "idle",
}: BaziTrainerWorkspaceProps) {
  const hasExplicitInitialState =
    Boolean(initialFormState) ||
    Boolean(initialSubmittedInput) ||
    Boolean(initialCalculatedState) ||
    initialSubmissionState !== "idle";

  if (hasExplicitInitialState) {
    const defaultFormState = createDefaultFormState();
    const nextFormState = initialFormState ?? defaultFormState;
    const currentSession = getBaziWorkspaceSessionState();
    const shouldHydrate =
      JSON.stringify(currentSession.formState) !== JSON.stringify(nextFormState) ||
      currentSession.submittedInput !== initialSubmittedInput ||
      currentSession.calculatedState !== initialCalculatedState ||
      currentSession.submissionState !== initialSubmissionState ||
      currentSession.errorMessage !== null;

    if (shouldHydrate) {
      seedBaziWorkspaceSession({
        formState: nextFormState,
        submittedInput: initialSubmittedInput,
        calculatedState: initialCalculatedState,
        submissionState: initialSubmissionState,
        errorMessage: null,
      });
    }
  }

  const formState = useBaziWorkspaceSessionStore((state) => state.formState);
  const submittedInput = useBaziWorkspaceSessionStore((state) => state.submittedInput);
  const calculatedState = useBaziWorkspaceSessionStore((state) => state.calculatedState);
  const submissionState = useBaziWorkspaceSessionStore((state) => state.submissionState);
  const errorMessage = useBaziWorkspaceSessionStore((state) => state.errorMessage);
  const updateFormField = useBaziWorkspaceSessionStore((state) => state.updateFormField);
  const setSubmissionState = useBaziWorkspaceSessionStore((state) => state.setSubmissionState);
  const setErrorMessage = useBaziWorkspaceSessionStore((state) => state.setErrorMessage);
  const applyCalculationResult = useBaziWorkspaceSessionStore((state) => state.applyCalculationResult);
  const resetSession = useBaziWorkspaceSessionStore((state) => state.resetSession);

  const resolvedFormState = hasExplicitInitialState
    ? initialFormState ?? formState
    : formState;
  const resolvedSubmittedInput = hasExplicitInitialState
    ? initialSubmittedInput
    : submittedInput;
  const resolvedCalculatedState = hasExplicitInitialState
    ? initialCalculatedState
    : calculatedState;
  const resolvedSubmissionState = hasExplicitInitialState
    ? initialSubmissionState
    : submissionState;
  const resolvedErrorMessage = hasExplicitInitialState ? null : errorMessage;

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    updateFormField(name, value);
  }

  function resetCalculationSession() {
    resetSession();
  }

  async function submitCalculation(options: SubmitCalculationOptions = {}) {
    if (resolvedCalculatedState || resolvedSubmissionState === "submitting") {
      return;
    }

    const payload = buildPayload(resolvedFormState);

    setSubmissionState("submitting");
    setErrorMessage(null);

    try {
      const response = await fetch("/api/bazi/calculate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as {
        calculatedState?: unknown;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "ยังไม่สามารถคำนวณดวงได้ในตอนนี้");
      }

      const parsedState = CalculatedStateSchema.parse(body.calculatedState);

      options.onBeforeApplyResult?.();
      applyCalculationResult({
        submittedInput: payload,
        calculatedState: parsedState,
      });
    } catch (error) {
      setSubmissionState("error");
      setErrorMessage(normalizeErrorMessage(error));
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
    options: SubmitCalculationOptions = {},
  ) {
    event.preventDefault();
    await submitCalculation(options);
  }

  return {
    formState: resolvedFormState,
    submittedInput: resolvedSubmittedInput,
    calculatedState: resolvedCalculatedState,
    submissionState: resolvedSubmissionState,
    errorMessage: resolvedErrorMessage,
    handleFieldChange,
    handleSubmit,
    resetCalculationSession,
  };
}