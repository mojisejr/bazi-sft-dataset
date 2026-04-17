"use client";

import { useState } from "react";
import {
  getAnnotationDraftContentState,
  getAnnotationProgressSummary,
  isAnnotationReadyForReview,
  useAnnotationStore,
} from "@/lib/bazi/annotation-store";

import { AnnotationWorkspace } from "@/components/bazi/AnnotationWorkspace";
import { BirthForm } from "@/components/bazi/BirthForm";
import { CalculatedBoard } from "@/components/bazi/CalculatedBoard";
import { useBaziCalculate } from "@/hooks/bazi/useBaziCalculate";
import { useDatasetPersistence } from "@/hooks/bazi/useDatasetPersistence";
import {
  getResetActionCopy,
  getStatusCopy,
  type BaziTrainerWorkspaceProps,
} from "@/lib/bazi/trainer-workspace";
import { SystemHeader } from "@/components/bazi/SystemHeader";

export {
  createDefaultFormState,
  getResetActionCopy,
  shouldConfirmSessionReset,
  type FormState,
} from "@/lib/bazi/trainer-workspace";

export function BaziTrainerWorkspace({
  initialFormState,
  initialSubmittedInput = null,
  initialCalculatedState = null,
  initialSubmissionState = "idle",
}: BaziTrainerWorkspaceProps) {
  const [activeWorkspace, setActiveWorkspace] = useState<"manual" | "queue">("manual");

  const {
    formState,
    submittedInput,
    calculatedState,
    submissionState,
    errorMessage,
    handleFieldChange,
    handleSubmit,
    resetCalculationSession,
  } = useBaziCalculate({
    initialFormState,
    initialSubmittedInput,
    initialCalculatedState,
    initialSubmissionState,
  });
  const annotationDimensions = useAnnotationStore((state) => state.dimensions);
  const expandedDimensionName = useAnnotationStore(
    (state) => state.expandedDimensionName,
  );
  const setExpandedDimension = useAnnotationStore(
    (state) => state.setExpandedDimension,
  );
  const updateThoughtProcess = useAnnotationStore(
    (state) => state.updateThoughtProcess,
  );
  const updateFinalPrediction = useAnnotationStore(
    (state) => state.updateFinalPrediction,
  );
  const annotationSummary = getAnnotationProgressSummary(annotationDimensions);
  const annotationDraftContentState = getAnnotationDraftContentState(annotationDimensions);
  const canCompleteAnnotation = isAnnotationReadyForReview(annotationDimensions);
  const {
    datasetStatus,
    saveState,
    saveErrorMessage,
    lastSavedAt,
    beginNewSession,
    persistAnnotation,
    handleCompleteAnnotation,
    handleAccordionToggle,
    handleReset,
  } = useDatasetPersistence({
    submittedInput,
    calculatedState,
    annotationDimensions,
    annotationDraftContentState,
    canCompleteAnnotation,
    expandedDimensionName,
    setExpandedDimension,
  });
  const statusCopy = getStatusCopy(submissionState, Boolean(calculatedState));
  const isSessionLocked = Boolean(calculatedState);
  const resetActionCopy = getResetActionCopy(datasetStatus);

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={statusCopy} />

      <section className="surface intake-stage">
        <BirthForm
          formState={formState}
          isSessionLocked={isSessionLocked}
          submissionState={submissionState}
          resetActionCopy={resetActionCopy}
          onFieldChange={handleFieldChange}
          onSubmit={(event) => handleSubmit(event, { onBeforeApplyResult: beginNewSession })}
          onReset={() => handleReset(resetCalculationSession)}
        />
      </section>

      <section className="workspace-stack">
        <CalculatedBoard
          submittedInput={submittedInput}
          calculatedState={calculatedState}
        />

        {calculatedState && (
          <div className="mx-auto w-full max-w-4xl px-4 pb-8 pt-4">
            <div className="flex justify-center mb-6">
              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveWorkspace("manual")}
                  className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                    activeWorkspace === "manual"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  🔮 พยากรณ์เอง
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWorkspace("queue")}
                  className={`rounded-full px-6 py-2 text-sm font-medium transition-colors ${
                    activeWorkspace === "queue"
                      ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  คิวตรวจงาน AI 🤖
                </button>
              </div>
            </div>

            {activeWorkspace === "manual" && (
              <AnnotationWorkspace
                hasCalculatedState={Boolean(calculatedState)}
                statusCopy={statusCopy}
                errorMessage={errorMessage}
                annotationSummary={annotationSummary}
                annotationDimensions={annotationDimensions}
                expandedDimensionName={expandedDimensionName}
                saveState={saveState}
                saveErrorMessage={saveErrorMessage}
                lastSavedAt={lastSavedAt}
                datasetStatus={datasetStatus}
                canCompleteAnnotation={canCompleteAnnotation}
                onCompleteAnnotation={handleCompleteAnnotation}
                onAccordionToggle={handleAccordionToggle}
                onThoughtProcessChange={updateThoughtProcess}
                onFinalPredictionChange={updateFinalPrediction}
                onPersistDraft={() => void persistAnnotation("draft")}
              />
            )}

            {activeWorkspace === "queue" && (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="mb-2 text-4xl">🤖</div>
                <h3 className="mb-1 text-lg font-medium text-slate-900 dark:text-white">ระบบคิวงานรอตรวจ</h3>
                <p className="text-sm">ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนา (Phase 4)</p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

export default function HomePage() {
  return <BaziTrainerWorkspace />;
}
