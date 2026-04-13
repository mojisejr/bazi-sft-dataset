"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";

import {
  CalculatedStateSchema,
  type CalculatedStateValue,
  type RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  buildPayload,
  createDefaultFormState,
  normalizeErrorMessage,
  type BaziTrainerWorkspaceProps,
  type FormState,
  type SubmissionState,
} from "@/lib/bazi/trainer-workspace";

type SubmitCalculationOptions = {
  onBeforeApplyResult?: () => void;
};

export function useBaziCalculate({
  initialFormState,
  initialSubmittedInput = null,
  initialCalculatedState = null,
  initialSubmissionState = "idle",
}: BaziTrainerWorkspaceProps) {
  const [formState, setFormState] = useState<FormState>(
    initialFormState ?? createDefaultFormState(),
  );
  const [submittedInput, setSubmittedInput] = useState<RawInputValue | null>(
    initialSubmittedInput,
  );
  const [calculatedState, setCalculatedState] = useState<CalculatedStateValue | null>(
    initialCalculatedState,
  );
  const [submissionState, setSubmissionState] = useState<SubmissionState>(
    initialSubmissionState,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleFieldChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetCalculationSession() {
    setFormState(createDefaultFormState());
    setCalculatedState(null);
    setSubmittedInput(null);
    setSubmissionState("idle");
    setErrorMessage(null);
  }

  async function submitCalculation(options: SubmitCalculationOptions = {}) {
    if (calculatedState || submissionState === "submitting") {
      return;
    }

    const payload = buildPayload(formState);

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
      setCalculatedState(parsedState);
      setSubmittedInput(payload);
      setSubmissionState("ready");
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
    formState,
    submittedInput,
    calculatedState,
    submissionState,
    errorMessage,
    handleFieldChange,
    handleSubmit,
    resetCalculationSession,
  };
}