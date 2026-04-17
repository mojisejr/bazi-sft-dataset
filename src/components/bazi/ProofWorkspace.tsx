"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ANNOTATION_DIMENSION_META,
  getAnnotationProgressSummary,
  type AnnotationDimensionDraftState,
  type AnnotationProgressSummary,
} from "@/lib/bazi/annotation-store";
import type { ProofDatasetRecord } from "@/lib/bazi/dataset-records";
import type { SaveDatasetStatus } from "@/lib/bazi/dataset-request";
import {
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type DraftAnnotationDataValue,
  type DraftDimensionValue,
  type StoredAnnotationDataValue,
} from "@/lib/bazi/schema-types";
import {
  formatScore,
  formatThaiBirthMoment,
  reportPillarColumns,
} from "@/lib/bazi/trainer-workspace";

type ProofWorkspaceProps = {
  record: ProofDatasetRecord;
  returnToPath?: string;
};

type ProofDimensionDraft = {
  thoughtProcess: string;
  finalPrediction: string;
  supportingSignals: string[];
  confidenceNote?: string;
};

type ProofDimensionDraftState = Record<AnnotationDimensionName, ProofDimensionDraft>;

type ProofSaveState = "idle" | "saving" | "saved" | "error";

function createEmptyProofDimensions(): ProofDimensionDraftState {
  return REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce((accumulator, dimensionName) => {
    accumulator[dimensionName] = {
      thoughtProcess: "",
      finalPrediction: "",
      supportingSignals: [],
    };

    return accumulator;
  }, {} as ProofDimensionDraftState);
}

function createProofDimensions(annotationData: StoredAnnotationDataValue | null) {
  const dimensions = createEmptyProofDimensions();

  for (const dimension of annotationData?.dimensions ?? []) {
    dimensions[dimension.dimension_name] = {
      thoughtProcess: dimension.thought_process,
      finalPrediction: dimension.final_prediction,
      supportingSignals: dimension.supporting_signals ?? [],
      confidenceNote: dimension.confidence_note,
    };
  }

  return dimensions;
}

function createAnnotationProgressSource(
  dimensions: ProofDimensionDraftState,
): AnnotationDimensionDraftState {
  return REQUIRED_ANNOTATION_DIMENSION_NAMES.reduce((accumulator, dimensionName) => {
    accumulator[dimensionName] = {
      thoughtProcess: dimensions[dimensionName].thoughtProcess,
      finalPrediction: dimensions[dimensionName].finalPrediction,
    };

    return accumulator;
  }, {} as AnnotationDimensionDraftState);
}

function createProofAnnotationData(
  dimensions: ProofDimensionDraftState,
  sinsaeProofNote: string,
  reviewSummary?: string,
): DraftAnnotationDataValue {
  return {
    version: "1.6",
    reviewSummary: reviewSummary?.trim() ? reviewSummary.trim() : undefined,
    sinsaeProofNote: sinsaeProofNote.trim() ? sinsaeProofNote.trim() : undefined,
    dimensions: REQUIRED_ANNOTATION_DIMENSION_NAMES.map((dimensionName) => {
      const draft = dimensions[dimensionName];

      return {
        dimension_name: dimensionName,
        thought_process: draft.thoughtProcess,
        final_prediction: draft.finalPrediction,
        supporting_signals: draft.supportingSignals,
        confidence_note: draft.confidenceNote,
      } satisfies DraftDimensionValue;
    }),
  };
}

function getStatusBadgeCopy(status: ProofDatasetRecord["status"]) {
  switch (status) {
    case "reviewed":
      return "ผ่านการตรวจแล้ว";
    case "rejected":
      return "ตีกลับแล้ว";
    case "exported":
      return "ส่งออกแล้ว";
    default:
      return "รอตรวจ";
  }
}

function getSaveMessage(
  saveState: ProofSaveState,
  saveErrorMessage: string | null,
  lastSavedAt: string | null,
  activeAction: SaveDatasetStatus | null,
) {
  if (saveState === "saving") {
    if (activeAction === "reviewed") {
      return "กำลังอนุมัติและบันทึกผลตรวจ...";
    }

    if (activeAction === "rejected") {
      return "กำลังตีกลับงาน AI พร้อมบันทึกเหตุผล...";
    }

    return "กำลังบันทึกความคืบหน้า...";
  }

  if (saveState === "error") {
    return saveErrorMessage ?? "ยังบันทึกไม่สำเร็จ ลองตรวจข้อมูลแล้วกดอีกครั้ง";
  }

  if (saveState === "saved") {
    return lastSavedAt
      ? `บันทึกความคืบหน้าล่าสุดเมื่อ ${new Intl.DateTimeFormat("th-TH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(new Date(lastSavedAt))}`
      : "บันทึกความคืบหน้าแล้ว";
  }

  return "แก้ไขข้อความได้ทันที จากนั้นค่อยเลือกอนุมัติหรือตีกลับพร้อมเหตุผล";
}

export function ProofWorkspace({ record, returnToPath = "/?workspace=queue" }: ProofWorkspaceProps) {
  const router = useRouter();
  const [dimensions, setDimensions] = useState<ProofDimensionDraftState>(() =>
    createProofDimensions(record.annotationData),
  );
  const [expandedDimensionName, setExpandedDimensionName] = useState<AnnotationDimensionName | null>(
    REQUIRED_ANNOTATION_DIMENSION_NAMES[0],
  );
  const [sinsaeProofNote, setSinsaeProofNote] = useState(
    record.annotationData?.sinsaeProofNote ?? "",
  );
  const [reviewSummary] = useState(record.annotationData?.reviewSummary ?? "");
  const [saveState, setSaveState] = useState<ProofSaveState>("idle");
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(record.updatedAt);
  const [activeAction, setActiveAction] = useState<SaveDatasetStatus | null>(null);

  const annotationSummary: AnnotationProgressSummary = getAnnotationProgressSummary(
    createAnnotationProgressSource(dimensions),
  );
  const canApprove =
    annotationSummary.completeCount === REQUIRED_ANNOTATION_DIMENSION_NAMES.length
    && sinsaeProofNote.trim().length > 0;
  const canReject = sinsaeProofNote.trim().length > 0;

  function updateDimension(
    dimensionName: AnnotationDimensionName,
    key: "thoughtProcess" | "finalPrediction",
    value: string,
  ) {
    setDimensions((current) => ({
      ...current,
      [dimensionName]: {
        ...current[dimensionName],
        [key]: value,
      },
    }));
  }

  async function handleSubmit(nextStatus: SaveDatasetStatus) {
    if (nextStatus === "reviewed" && !canApprove) {
      setSaveState("error");
      setSaveErrorMessage("ต้องเติมข้อมูลให้ครบทั้ง 15 มิติและใส่เหตุผลประกอบการตัดสินใจก่อนอนุมัติ");
      return;
    }

    if (nextStatus === "rejected" && !canReject) {
      setSaveState("error");
      setSaveErrorMessage("การตีกลับงาน AI ต้องใส่เหตุผลประกอบการตัดสินใจก่อนทุกครั้ง");
      return;
    }

    setActiveAction(nextStatus);
    setSaveState("saving");
    setSaveErrorMessage(null);

    try {
      const response = await fetch("/api/dataset/proof", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          recordId: record.id,
          status: nextStatus,
          annotationData: createProofAnnotationData(dimensions, sinsaeProofNote, reviewSummary),
        }),
      });
      const body = (await response.json()) as {
        updatedAt?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "ยังไม่สามารถบันทึกผลตรวจได้ในตอนนี้");
      }

      setLastSavedAt(body.updatedAt ?? new Date().toISOString());

      if (nextStatus === "draft") {
        setSaveState("saved");
        return;
      }

      router.push(returnToPath);
      router.refresh();
    } catch (error) {
      setSaveState("error");
      setSaveErrorMessage(
        error instanceof Error ? error.message : "ยังไม่สามารถบันทึกผลตรวจได้ในตอนนี้",
      );
    }
  }

  return (
    <section className="workspace-stack">
      <section className="surface inset-card proof-hero-card">
        <div>
          <p className="section-kicker">Phase 5</p>
          <h2>หน้าตรวจทานคำทำนาย AI</h2>
          <p className="annotation-intro">
            อ่านภาพรวมดวง แก้ข้อความทีละมิติ แล้วปิดงานด้วยการอนุมัติหรือการตีกลับพร้อมเหตุผลในหน้าเดียว
          </p>
        </div>
        <div className="message-card__actions">
          <Link className="secondary-action pending-link" href={returnToPath}>
            กลับไปคิวรอตรวจ
          </Link>
        </div>
      </section>

      <div className="proof-layout">
        <aside className="proof-sidebar">
          <section className="surface inset-card proof-summary-card">
            <div className="proof-summary-card__header">
              <div>
                <p className="section-kicker">ข้อมูลเคส</p>
                <h3>รายละเอียดที่ใช้ประกอบการตรวจ</h3>
              </div>
              <span className="proof-status-badge">{getStatusBadgeCopy(record.status)}</span>
            </div>

            <dl className="pending-metadata-list proof-meta-list">
              <div className="pending-metadata-row">
                <dt>วันเวลาเกิด</dt>
                <dd>{formatThaiBirthMoment(record.rawInput)}</dd>
              </div>
              <div className="pending-metadata-row">
                <dt>จังหวัดเกิด</dt>
                <dd>{record.rawInput.province}</dd>
              </div>
              <div className="pending-metadata-row">
                <dt>ขอบเขตคำถาม</dt>
                <dd>{record.intentDomain}</dd>
              </div>
              <div className="pending-metadata-row">
                <dt>รหัสรายการ</dt>
                <dd>{record.id}</dd>
              </div>
            </dl>
          </section>

          <section className="surface inset-card proof-summary-card">
            <div>
              <p className="section-kicker">แกนดวงสำหรับอ่านเร็ว</p>
              <h3>สรุปหลักที่ต้องเห็นก่อนแก้คำทำนาย</h3>
            </div>

            <div className="proof-pill-strip">
              <div className="proof-pill-chip">
                <span>ดิถี</span>
                <strong>{record.calculatedState.dayMaster}</strong>
              </div>
              <div className="proof-pill-chip">
                <span>คะแนนพลัง</span>
                <strong>{formatScore(record.calculatedState.strengthScore)}</strong>
              </div>
            </div>

            <div className="proof-pillars-grid" aria-label="proof record pillars">
              {reportPillarColumns.map((column) => {
                const pillar = record.calculatedState.fourPillars[column.key];

                return (
                  <article key={column.key} className="proof-pillar-card">
                    <span>{column.label}</span>
                    <strong>{`${pillar.stem}${pillar.branch}`}</strong>
                    <small>{pillar.hiddenStems?.join(" · ") ?? "-"}</small>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="surface inset-card proof-summary-card">
            <p className="section-kicker">เงื่อนไขการปิดงาน</p>
            <ul className="workflow-list proof-guidance-list">
              <li>อนุมัติได้เมื่อครบทั้ง 15 มิติและมีเหตุผลประกอบการตัดสินใจ</li>
              <li>ตีกลับได้ทันทีหาก logic ของ AI ผิด แต่ต้องบอกเหตุผลให้ชัด</li>
              <li>ถ้ายังไม่พร้อมปิดงาน สามารถบันทึกความคืบหน้าไว้ก่อน</li>
            </ul>
          </section>
        </aside>

        <div className="proof-main">
          <section className="surface inset-card annotation-summary-card">
            <div>
              <p className="section-kicker">ความคืบหน้าการตรวจ</p>
              <h3>แก้ไขทีละมิติ แล้วค่อยตัดสินใจตอนท้าย</h3>
            </div>

            <div className="annotation-metrics" aria-label="proof progress summary">
              <div className="metric-pill metric-pill--complete">
                <span className="metric-dot" aria-hidden="true" />
                ครบแล้ว {annotationSummary.completeCount}
              </div>
              <div className="metric-pill metric-pill--draft">
                <span className="metric-dot" aria-hidden="true" />
                กำลังแก้ {annotationSummary.draftCount}
              </div>
              <div className="metric-pill metric-pill--not-started">
                <span className="metric-dot" aria-hidden="true" />
                ยังไม่แตะ {annotationSummary.notStartedCount}
              </div>
            </div>

            <p className={`save-indicator save-indicator--${saveState}`} aria-live="polite">
              {getSaveMessage(saveState, saveErrorMessage, lastSavedAt, activeAction)}
            </p>
          </section>

          <div className="accordion-list">
            {ANNOTATION_DIMENSION_META.map((dimension) => {
              const draft = dimensions[dimension.dimensionName];
              const currentCount =
                draft.thoughtProcess.trim().length > 0 && draft.finalPrediction.trim().length > 0
                  ? "complete"
                  : draft.thoughtProcess.trim().length > 0 || draft.finalPrediction.trim().length > 0
                    ? "draft"
                    : "not-started";
              const isExpanded = expandedDimensionName === dimension.dimensionName;

              return (
                <section
                  key={dimension.dimensionName}
                  className="surface inset-card accordion-item"
                >
                  <button
                    type="button"
                    className="accordion-trigger"
                    onClick={() =>
                      setExpandedDimensionName(
                        expandedDimensionName === dimension.dimensionName
                          ? null
                          : dimension.dimensionName,
                      )
                    }
                    aria-expanded={isExpanded}
                  >
                    <span className="accordion-index">{String(dimension.step).padStart(2, "0")}</span>

                    <span className="accordion-copy">
                      <strong>{dimension.title}</strong>
                      <span>{dimension.guidance}</span>
                    </span>

                    <span className={`progress-badge progress-badge--${currentCount}`}>
                      <span className="progress-dot" aria-hidden="true" />
                      {currentCount === "complete"
                        ? "พร้อม"
                        : currentCount === "draft"
                          ? "กำลังแก้"
                          : "ยังไม่แตะ"}
                    </span>
                  </button>

                  {isExpanded ? (
                    <div className="annotation-body proof-annotation-body">
                      <label className="field">
                        <span>เหตุผลที่ใช้ประกอบการตรวจ</span>
                        <textarea
                          name={`${dimension.dimensionName}-thought-process`}
                          rows={5}
                          value={draft.thoughtProcess}
                          placeholder={dimension.thoughtPrompt}
                          onChange={(event) =>
                            updateDimension(
                              dimension.dimensionName,
                              "thoughtProcess",
                              event.target.value,
                            )
                          }
                        />
                      </label>

                      <label className="field">
                        <span>คำทำนายที่พร้อมส่งต่อ</span>
                        <textarea
                          name={`${dimension.dimensionName}-prediction`}
                          rows={4}
                          value={draft.finalPrediction}
                          placeholder={dimension.predictionPrompt}
                          onChange={(event) =>
                            updateDimension(
                              dimension.dimensionName,
                              "finalPrediction",
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          <section className="surface inset-card proof-note-card">
            <div>
              <p className="section-kicker">เหตุผลประกอบการตัดสินใจ</p>
              <h3>ส่วนนี้จำเป็นทั้งตอนอนุมัติและตอนตีกลับ</h3>
              <p className="annotation-intro">
                อธิบายให้ชัดว่าคุณแก้อะไร เห็นอะไรผิด หรือยืนยันเพราะอะไร เพื่อให้ record นี้มีร่องรอยการตรวจที่ใช้งานต่อได้จริง
              </p>
            </div>

            <label className="field">
              <span>บันทึกของซินแส</span>
              <textarea
                name="sinsae-proof-note"
                rows={5}
                value={sinsaeProofNote}
                placeholder="สรุปเหตุผลที่อนุมัติหรืออธิบายว่าทำไมจึงตีกลับงาน AI"
                onChange={(event) => setSinsaeProofNote(event.target.value)}
              />
            </label>
          </section>

          <section className="surface inset-card proof-actions-card">
            <div>
              <p className="section-kicker">ปิดงาน</p>
              <h3>เลือกทางออกของ record นี้</h3>
            </div>

            <div className="proof-action-group">
              <button
                type="button"
                className="secondary-action"
                onClick={() => void handleSubmit("draft")}
                disabled={saveState === "saving"}
              >
                บันทึกความคืบหน้าไว้ก่อน
              </button>

              <button
                type="button"
                className="secondary-action secondary-action--warning"
                onClick={() => void handleSubmit("rejected")}
                disabled={saveState === "saving" || !canReject}
              >
                ตีกลับงาน AI
              </button>

              <button
                type="button"
                className="primary-action proof-primary-action"
                onClick={() => void handleSubmit("reviewed")}
                disabled={saveState === "saving" || !canApprove}
              >
                อนุมัติและปิดงาน
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}