"use client";

import {
  ANNOTATION_DIMENSION_META,
  getDimensionProgress,
  type AnnotationDimensionDraftState,
  type AnnotationProgressSummary,
} from "@/lib/bazi/annotation-store";
import type { SaveDatasetStatus } from "@/lib/bazi/dataset-records";
import type { AnnotationDimensionName } from "@/lib/bazi/schema-types";
import {
  formatSaveTimestamp,
  getProgressCopy,
  getProgressTone,
  type SaveState,
  type StatusCopy,
} from "@/lib/bazi/trainer-workspace";

type AnnotationWorkspaceProps = {
  hasCalculatedState: boolean;
  statusCopy: StatusCopy;
  errorMessage: string | null;
  annotationSummary: AnnotationProgressSummary;
  annotationDimensions: AnnotationDimensionDraftState;
  expandedDimensionName: AnnotationDimensionName;
  saveState: SaveState;
  saveErrorMessage: string | null;
  lastSavedAt: string | null;
  datasetStatus: SaveDatasetStatus | null;
  canCompleteAnnotation: boolean;
  onCompleteAnnotation: () => void | Promise<void>;
  onAccordionToggle: (dimensionName: AnnotationDimensionName) => void | Promise<void>;
  onThoughtProcessChange: (dimensionName: AnnotationDimensionName, value: string) => void;
  onFinalPredictionChange: (dimensionName: AnnotationDimensionName, value: string) => void;
  onPersistDraft: () => void | Promise<void>;
};

export function AnnotationWorkspace({
  hasCalculatedState,
  statusCopy,
  errorMessage,
  annotationSummary,
  annotationDimensions,
  expandedDimensionName,
  saveState,
  saveErrorMessage,
  lastSavedAt,
  datasetStatus,
  canCompleteAnnotation,
  onCompleteAnnotation,
  onAccordionToggle,
  onThoughtProcessChange,
  onFinalPredictionChange,
  onPersistDraft,
}: AnnotationWorkspaceProps) {
  if (!hasCalculatedState) {
    return (
      <div className="surface inset-card message-card" aria-live="polite">
        <p className="section-kicker">สัญญาณจากระบบ</p>
        <h3>{statusCopy.label}</h3>
        <p>{errorMessage ?? statusCopy.detail}</p>
      </div>
    );
  }

  return (
    <section className="annotation-stage">
      <div className="surface inset-card annotation-summary-card">
        <div>
          <p className="section-kicker">สมุดวิเคราะห์ 15 มิติ</p>
          <h3>ไล่เขียนทีละหัวข้อแบบไม่หลงทาง</h3>
          <p className="annotation-intro">
            เริ่มจากหัวข้อที่ระบบเปิดไว้ก่อน แล้วค่อยเติมเหตุผลการวิเคราะห์ให้ชัด เมื่อเหตุผลครบ ระบบจะเปิดช่องคำทำนายของหัวข้อนั้นเอง
          </p>
        </div>

        <div className="annotation-metrics" aria-label="annotation progress summary">
          <div className="metric-pill metric-pill--complete">
            <span className="metric-dot" aria-hidden="true" />
            ครบแล้ว {annotationSummary.completeCount}
          </div>
          <div className="metric-pill metric-pill--draft">
            <span className="metric-dot" aria-hidden="true" />
            กำลังเขียน {annotationSummary.draftCount}
          </div>
          <div className="metric-pill metric-pill--not-started">
            <span className="metric-dot" aria-hidden="true" />
            รอเริ่ม {annotationSummary.notStartedCount}
          </div>
        </div>

        <div className="annotation-actions">
          <p className={`save-indicator save-indicator--${saveState}`} aria-live="polite">
            {saveState === "saving"
              ? datasetStatus === "reviewed"
                ? "กำลังปิด annotation ชุดนี้..."
                : "Auto-saving..."
              : saveState === "error"
                ? saveErrorMessage ?? "บันทึกไม่สำเร็จ ลองแก้ไขแล้ว blur อีกครั้ง"
                : datasetStatus === "reviewed"
                  ? `Annotation reviewed แล้ว • ${formatSaveTimestamp(lastSavedAt)}`
                  : `Auto-saved • ${formatSaveTimestamp(lastSavedAt)}`}
          </p>

          <button
            type="button"
            className="secondary-action"
            onClick={() => void onCompleteAnnotation()}
            disabled={
              !canCompleteAnnotation ||
              saveState === "saving" ||
              datasetStatus === "reviewed"
            }
          >
            {datasetStatus === "reviewed"
              ? "Reviewed แล้ว"
              : saveState === "saving"
                ? "กำลังบันทึก..."
                : "Complete Annotation"}
          </button>
        </div>
      </div>

      <div className="accordion-list">
        {ANNOTATION_DIMENSION_META.map((dimension) => {
          const draft = annotationDimensions[dimension.dimensionName];
          const progress = getDimensionProgress(draft);
          const predictionUnlocked = draft.thoughtProcess.trim().length > 0;
          const isExpanded = expandedDimensionName === dimension.dimensionName;

          return (
            <section
              key={dimension.dimensionName}
              className="surface inset-card accordion-item"
            >
              <button
                type="button"
                className="accordion-trigger"
                onClick={() => void onAccordionToggle(dimension.dimensionName)}
                aria-expanded={isExpanded}
              >
                <span className="accordion-index">{String(dimension.step).padStart(2, "0")}</span>

                <span className="accordion-copy">
                  <strong>{dimension.title}</strong>
                  <span>{dimension.guidance}</span>
                </span>

                <span className={`progress-badge progress-badge--${getProgressTone(progress)}`}>
                  <span className="progress-dot" aria-hidden="true" />
                  {getProgressCopy(progress)}
                </span>
              </button>

              {isExpanded ? (
                <div className="annotation-body">
                  <label className="field">
                    <span>เหตุผลการวิเคราะห์</span>
                    <textarea
                      name={`${dimension.dimensionName}-thought-process`}
                      rows={5}
                      value={draft.thoughtProcess}
                      placeholder={dimension.thoughtPrompt}
                      onBlur={() => void onPersistDraft()}
                      onChange={(event) =>
                        onThoughtProcessChange(dimension.dimensionName, event.target.value)
                      }
                    />
                  </label>

                  <p className="field-hint">{dimension.guidance}</p>

                  <label className="field">
                    <span>คำทำนาย</span>
                    <textarea
                      name={`${dimension.dimensionName}-prediction`}
                      rows={4}
                      value={draft.finalPrediction}
                      placeholder={dimension.predictionPrompt}
                      disabled={!predictionUnlocked}
                      onBlur={() => void onPersistDraft()}
                      onChange={(event) =>
                        onFinalPredictionChange(dimension.dimensionName, event.target.value)
                      }
                    />
                  </label>

                  {predictionUnlocked ? null : (
                    <p className="prediction-lock">
                      เติมเหตุผลการวิเคราะห์ก่อน แล้วช่องคำทำนายจะเปิดให้อัตโนมัติ
                    </p>
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}