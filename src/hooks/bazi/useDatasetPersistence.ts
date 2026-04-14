"use client";

import { useRef, useState } from "react";

import {
  createDraftAnnotationData,
  resetAnnotationStore,
  type AnnotationDimensionDraftState,
  type AnnotationDraftContentState,
} from "@/lib/bazi/annotation-store";
import {
  createDraftAnnotationPayload,
  type SaveDatasetStatus,
} from "@/lib/bazi/dataset-request";
import type {
  AnnotationDimensionName,
  CalculatedStateValue,
  RawInputValue,
} from "@/lib/bazi/schema-types";
import {
  normalizeErrorMessage,
  shouldConfirmSessionReset,
  type SaveState,
} from "@/lib/bazi/trainer-workspace";

type UseDatasetPersistenceOptions = {
  submittedInput: RawInputValue | null;
  calculatedState: CalculatedStateValue | null;
  annotationDimensions: AnnotationDimensionDraftState;
  annotationDraftContentState: AnnotationDraftContentState;
  canCompleteAnnotation: boolean;
  expandedDimensionName: AnnotationDimensionName | null;
  setExpandedDimension: (dimensionName: AnnotationDimensionName | null) => void;
};

export function useDatasetPersistence({
  submittedInput,
  calculatedState,
  annotationDimensions,
  annotationDraftContentState,
  canCompleteAnnotation,
  expandedDimensionName,
  setExpandedDimension,
}: UseDatasetPersistenceOptions) {
  const [datasetRecordId, setDatasetRecordId] = useState<string | null>(null);
  const [datasetStatus, setDatasetStatus] = useState<SaveDatasetStatus | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastSavedSignature, setLastSavedSignature] = useState<string | null>(null);
  const sessionVersionRef = useRef(0);

  function clearPersistedSessionState() {
    resetAnnotationStore();
    setDatasetRecordId(null);
    setDatasetStatus(null);
    setSaveState("idle");
    setSaveErrorMessage(null);
    setLastSavedAt(null);
    setLastSavedSignature(null);
  }

  function beginNewSession() {
    sessionVersionRef.current += 1;
    void fetch("/api/dataset/purge-drafts", {
      method: "POST",
    }).catch(() => undefined);
    clearPersistedSessionState();
  }

  async function persistAnnotation(status: SaveDatasetStatus) {
    if (!submittedInput || !calculatedState) {
      return true;
    }

    const requestSessionVersion = sessionVersionRef.current;
    const annotationData = createDraftAnnotationData(annotationDimensions);
    const requestPayload = createDraftAnnotationPayload(
      submittedInput,
      calculatedState,
      annotationData,
      status,
      datasetRecordId ?? undefined,
    );
    const nextSignature = JSON.stringify(requestPayload);

    if (
      status === "draft" &&
      annotationDraftContentState === "empty" &&
      !datasetRecordId
    ) {
      return true;
    }

    if (status === "draft" && nextSignature === lastSavedSignature) {
      return true;
    }

    setSaveState("saving");
    setSaveErrorMessage(null);

    try {
      const response = await fetch("/api/dataset/save", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });
      const body = (await response.json()) as {
        recordId?: string;
        status?: SaveDatasetStatus;
        updatedAt?: string;
        error?: string;
      };

      if (requestSessionVersion !== sessionVersionRef.current) {
        return false;
      }

      if (!response.ok) {
        throw new Error(body.error ?? "ยังไม่สามารถบันทึก annotation ได้ในตอนนี้");
      }

      setDatasetRecordId(body.recordId ?? null);
      setDatasetStatus(body.status ?? status);
      setLastSavedAt(body.updatedAt ?? null);
      setLastSavedSignature(nextSignature);
      setSaveState("saved");

      if (canCompleteAnnotation && expandedDimensionName !== null) {
        setExpandedDimension(null);
      }

      return true;
    } catch (error) {
      if (requestSessionVersion !== sessionVersionRef.current) {
        return false;
      }

      setSaveState("error");
      setSaveErrorMessage(normalizeErrorMessage(error));

      return false;
    }
  }

  async function handleCompleteAnnotation() {
    if (!canCompleteAnnotation) {
      return;
    }

    await persistAnnotation("reviewed");
  }

  async function handleAccordionToggle(dimensionName: AnnotationDimensionName) {
    if (expandedDimensionName !== dimensionName) {
      await persistAnnotation("draft");
    }

    setExpandedDimension(expandedDimensionName === dimensionName ? null : dimensionName);
  }

  function handleReset(onResetSession: () => void) {
    if (shouldConfirmSessionReset(datasetRecordId, datasetStatus)) {
      const shouldReset = window.confirm(
        "คุณยังวิเคราะห์ดวงนี้ไม่เสร็จ ยืนยันว่าจะรีเซ็ตเพื่อผูกดวงใหม่หรือไม่?",
      );

      if (!shouldReset) {
        return;
      }
    }

    beginNewSession();
    onResetSession();
  }

  return {
    datasetRecordId,
    datasetStatus,
    saveState,
    saveErrorMessage,
    lastSavedAt,
    clearPersistedSessionState,
    beginNewSession,
    persistAnnotation,
    handleCompleteAnnotation,
    handleAccordionToggle,
    handleReset,
  };
}