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
      </section>
    </main>
  );
}

export default function HomePage() {
  return <BaziTrainerWorkspace />;
}
