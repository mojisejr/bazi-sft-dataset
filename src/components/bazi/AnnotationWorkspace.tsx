"use client";

import { useEffect, useRef, useState } from "react";

import {
  ANNOTATION_DIMENSION_META,
  getDimensionProgress,
  type AnnotationDimensionDraftState,
  type AnnotationProgressSummary,
} from "@/lib/bazi/annotation-store";
import type { SaveDatasetStatus } from "@/lib/bazi/dataset-request";
import type { AnnotationDimensionName } from "@/lib/bazi/schema-types";
import {
  appendSpeechTranscript,
  useWebSpeech,
} from "@/hooks/bazi/useWebSpeech";
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
  expandedDimensionName: AnnotationDimensionName | null;
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
  const [activeVoiceDimension, setActiveVoiceDimension] =
    useState<AnnotationDimensionName | null>(null);
  const activeVoiceDimensionRef = useRef<AnnotationDimensionName | null>(null);
  const annotationDimensionsRef = useRef(annotationDimensions);
  const pendingVoicePersistDimensionRef =
    useRef<AnnotationDimensionName | null>(null);

  useEffect(() => {
    activeVoiceDimensionRef.current = activeVoiceDimension;
  }, [activeVoiceDimension]);

  useEffect(() => {
    annotationDimensionsRef.current = annotationDimensions;
  }, [annotationDimensions]);

  const {
    isSupported: isVoiceSupported,
    isListening,
    interimTranscript,
    errorMessage: speechErrorMessage,
    startListening,
    stopListening,
  } = useWebSpeech({
    onTranscript: (transcript) => {
      const dimensionName = activeVoiceDimensionRef.current;

      if (!dimensionName) {
        return;
      }

      const currentValue = annotationDimensionsRef.current[dimensionName].thoughtProcess;

      onThoughtProcessChange(
        dimensionName,
        appendSpeechTranscript(currentValue, transcript),
      );
      pendingVoicePersistDimensionRef.current = dimensionName;
    },
    onSessionEnd: () => {
      setActiveVoiceDimension(null);
    },
  });

  useEffect(() => {
    const pendingVoicePersistDimension = pendingVoicePersistDimensionRef.current;

    if (!pendingVoicePersistDimension) {
      return;
    }

    const draft = annotationDimensions[pendingVoicePersistDimension];

    if (draft.thoughtProcess.trim().length === 0) {
      return;
    }

    pendingVoicePersistDimensionRef.current = null;
    void onPersistDraft();
  }, [annotationDimensions, onPersistDraft]);

  function handleVoiceToggle(dimensionName: AnnotationDimensionName) {
    if (!isVoiceSupported) {
      return;
    }

    if (isListening && activeVoiceDimension === dimensionName) {
      stopListening();
      return;
    }

    if (isListening) {
      return;
    }

    setActiveVoiceDimension(dimensionName);

    if (!startListening()) {
      setActiveVoiceDimension(null);
    }
  }

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
      <div className="annotation-stage__lead">
        <p className="section-kicker">เริ่มเขียนคำพยากรณ์</p>
        <h3>เมื่ออ่านภาพรวมด้านบนจบแล้ว ค่อยเขียนคำทำนายนิสัยพื้นฐาน</h3>
        <p className="annotation-intro">
          ส่วนด้านบนคือ reading zone สำหรับจับโครงดวง ส่วนจากนี้คือ writing zone ที่ค่อย ๆ แปลง insight ให้เป็นคำพยากรณ์พร้อมส่งต่อ
        </p>
      </div>

      <div className="surface inset-card annotation-summary-card">
        <div>
          <p className="section-kicker">สมุดวิเคราะห์นิสัยพื้นฐาน</p>
          <h3>ไล่เขียนแกนนิสัยให้ชัดก่อนส่งต่อ</h3>
          <p className="annotation-intro">
            เริ่มจากการสรุปแกนนิสัยพื้นฐานก่อน แล้วค่อยเติมเหตุผลการวิเคราะห์ให้ชัด เมื่อเหตุผลครบ ระบบจะเปิดช่องคำทำนายให้อัตโนมัติ
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
                ? "กำลังปิดงานคำพยากรณ์ชุดนี้..."
                : "กำลังบันทึกความคืบหน้า..."
              : saveState === "error"
                ? saveErrorMessage ?? "บันทึกไม่สำเร็จ ลองแก้ไขแล้ว blur อีกครั้ง"
                : datasetStatus === "reviewed"
                  ? `ปิดงานคำพยากรณ์แล้ว • ${formatSaveTimestamp(lastSavedAt)}`
                  : `บันทึกความคืบหน้าแล้ว • ${formatSaveTimestamp(lastSavedAt)}`}
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
              ? "ปิดงานแล้ว"
              : saveState === "saving"
                ? "กำลังบันทึก..."
                : "ปิดงานคำพยากรณ์"}
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
                    <div className="field-toolbar">
                      <span>เหตุผลการวิเคราะห์</span>
                      <button
                        type="button"
                        className={`voice-action${
                          isListening && activeVoiceDimension === dimension.dimensionName
                            ? " voice-action--listening"
                            : ""
                        }`}
                        onClick={() => handleVoiceToggle(dimension.dimensionName)}
                        aria-pressed={
                          isListening && activeVoiceDimension === dimension.dimensionName
                        }
                        disabled={
                          isListening && activeVoiceDimension !== dimension.dimensionName
                        }
                      >
                        {isListening && activeVoiceDimension === dimension.dimensionName
                          ? "หยุดการฟัง"
                          : "พูดด้วยเสียง"}
                      </button>
                    </div>
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

                  {!isVoiceSupported ? (
                    <p className="voice-support-note">
                      เบราว์เซอร์นี้ยังไม่รองรับ dictation ใช้วิธีพิมพ์ตามปกติแทนได้ทันที
                    </p>
                  ) : null}

                  {isListening && activeVoiceDimension === dimension.dimensionName ? (
                    <p className="voice-live-note" aria-live="polite">
                      {interimTranscript.length > 0
                        ? `กำลังฟัง: ${interimTranscript}`
                        : "กำลังฟังอยู่ พูดช้า ๆ แล้วระบบจะเติมข้อความให้อัตโนมัติ"}
                    </p>
                  ) : null}

                  {speechErrorMessage && activeVoiceDimension === dimension.dimensionName ? (
                    <p className="voice-error" aria-live="polite">
                      {speechErrorMessage}
                    </p>
                  ) : null}

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

      {canCompleteAnnotation ? (
        <div className="surface inset-card completion-reveal" aria-live="polite">
          <div>
            <p className="section-kicker">พร้อมส่งงาน</p>
            <h3>คำทำนายนิสัยพื้นฐานครบแล้ว</h3>
            <p className="annotation-intro">
              ตรวจอีกครั้งได้ทันที หรือกดยืนยันเพื่อปิด annotation ชุดนี้เป็น reviewed
            </p>
          </div>

          <button
            type="button"
            className="primary-action completion-reveal__action"
            onClick={() => void onCompleteAnnotation()}
            disabled={saveState === "saving" || datasetStatus === "reviewed"}
          >
            {datasetStatus === "reviewed"
              ? "ตรวจแล้ว"
              : saveState === "saving"
                ? "กำลังบันทึก..."
                : "ยืนยันคำพยากรณ์"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
