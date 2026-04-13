"use client";

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
      <section className="surface trainer-header">
        <div className="brand-lockup">
          <p className="brand-mark">Bazi Trainer</p>
          <h1>Bazi Trainer that makes ซินแส ซินแส !</h1>
          <p className="brand-story">
            พื้นที่ทำงานที่พาเรื่องยากให้ไหลลื่น ตั้งข้อมูลให้ชัด คำนวณให้ตรง แล้วอ่านภาพรวมได้ทันที
            แบบเรียบง่ายแต่มั่นคง
          </p>
        </div>

        <div className="status-stack">
          <div className={`status-chip status-chip--${statusCopy.tone}`}>
            <span className="status-dot" aria-hidden="true" />
            {statusCopy.label}
          </div>
          <p className="status-detail">{statusCopy.detail}</p>
        </div>
      </section>

      <section className="trainer-grid">
        <CalculatedBoard
          submittedInput={submittedInput}
          calculatedState={calculatedState}
        />

        <aside className="surface intake-column">
          <BirthForm
            formState={formState}
            isSessionLocked={isSessionLocked}
            submissionState={submissionState}
            resetActionCopy={resetActionCopy}
            onFieldChange={handleFieldChange}
            onSubmit={(event) => handleSubmit(event, { onBeforeApplyResult: beginNewSession })}
            onReset={() => handleReset(resetCalculationSession)}
          />

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
        </aside>
      </section>
    </main>
  );
}

export default function HomePage() {
  return <BaziTrainerWorkspace />;
}