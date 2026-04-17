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

function getWorkspaceStatusCopy(
  activeWorkspace: "manual" | "queue",
  statusCopy: ReturnType<typeof getStatusCopy>,
) {
  if (activeWorkspace === "queue") {
    return {
      tone: "ready" as const,
      label: "พร้อมตรวจงาน AI",
      detail: "เลือกเข้าคิว proof draft ที่ถูก generate ไว้แล้วได้ทันที โดยไม่ต้องตั้งดวงใหม่",
    };
  }

  return statusCopy;
}

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
  const workspaceStatusCopy = getWorkspaceStatusCopy(activeWorkspace, statusCopy);
  const isSessionLocked = Boolean(calculatedState);
  const resetActionCopy = getResetActionCopy(datasetStatus);

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={workspaceStatusCopy} />

      <section className="workspace-switch-shell">
        <div className="workspace-switch" role="tablist" aria-label="workspace mode switch">
          <div className="workspace-switch__backdrop" aria-hidden="true" />
          <div className="workspace-switch__rail">
            <button
              type="button"
              onClick={() => setActiveWorkspace("manual")}
              aria-pressed={activeWorkspace === "manual"}
              className={`workspace-switch__option ${
                activeWorkspace === "manual"
                  ? "workspace-switch__option--active"
                  : "workspace-switch__option--idle"
              }`}
            >
              <span className="workspace-switch__icon" aria-hidden="true">🔮</span>
              <span className="workspace-switch__label">พยากรณ์เอง</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspace("queue")}
              aria-pressed={activeWorkspace === "queue"}
              className={`workspace-switch__option ${
                activeWorkspace === "queue"
                  ? "workspace-switch__option--active"
                  : "workspace-switch__option--idle"
              }`}
            >
              <span className="workspace-switch__icon" aria-hidden="true">🤖</span>
              <span className="workspace-switch__label">คิวตรวจงาน AI</span>
            </button>
          </div>
        </div>
      </section>

      {activeWorkspace === "manual" && (
        <>
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
              </div>
            )}
          </section>
        </>
      )}

      {activeWorkspace === "queue" && (
        <section className="workspace-stack px-4 pb-10 pt-2">
          <div className="mx-auto w-full max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-3 text-4xl">🤖</div>
            <p className="mb-2 text-sm font-medium text-amber-700 dark:text-amber-300">Proof Queue Workspace</p>
            <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-white">เข้าคิวตรวจ draft ได้โดยไม่ต้องตั้งดวงก่อน</h3>
            <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              พื้นที่นี้จะใช้สำหรับเปิดรายการ draft ที่ script generate และ import เข้า database แล้ว จากนั้นซินแสค่อยเลือก
              record เพื่อ proof, แก้ข้อความ, และตัดสินใจ approve หรือ reject ต่อในขั้นตอนถัดไป
            </p>
            <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              ฟีเจอร์นี้กำลังอยู่ระหว่างการพัฒนาใน Phase 4 แต่ root flow ถูกแก้แล้วให้เข้า queue ได้ตรงๆ ตั้งแต่หน้าแรก
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

export default function HomePage() {
  return <BaziTrainerWorkspace />;
}
