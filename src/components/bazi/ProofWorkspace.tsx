"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  getAnnotationProgressSummary,
  type AnnotationDimensionDraftState,
  type AnnotationProgressSummary,
} from "@/lib/bazi/annotation-store";
import {
  PROOF_WORKSPACE_DIMENSION_META,
  PROOF_WORKSPACE_DIMENSION_ORDER,
} from "@/lib/bazi/annotation-dimension-meta";
import type { ProofDatasetRecord } from "@/lib/bazi/dataset-records";
import type { SaveDatasetStatus } from "@/lib/bazi/dataset-request";
import {
  ACTIVE_RLHF_DIMENSION_NAMES,
  REQUIRED_ANNOTATION_DIMENSION_NAMES,
  type AnnotationDimensionName,
  type DraftAnnotationDataValue,
  type DraftDimensionValue,
  type StoredAnnotationDataValue,
} from "@/lib/bazi/schema-types";
import {
  formatScore,
  formatThaiBirthMoment,
} from "@/lib/bazi/trainer-workspace";
import { CalculatedBoard } from "@/components/bazi/CalculatedBoard";
import { CaseContextSheet } from "@/components/bazi/CaseContextSheet";
import { DetailOverlay } from "@/components/bazi/DetailOverlay";
import {
  classifyOperatorStrengthScore,
  OPERATOR_STRENGTH_CLASS_BANDS,
} from "@/lib/bazi/constants/operator-strength";

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
    dimensions: ACTIVE_RLHF_DIMENSION_NAMES.map((dimensionName) => {
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

function getReviewStateCopy(
  state: "active" | "stale" | "needs-reproof" | "superseded" | undefined,
) {
  switch (state) {
    case "stale":
      return "ต้องตรวจซ้ำ";
    case "needs-reproof":
      return "ต้องตรวจซ้ำใหม่";
    case "superseded":
      return "ถูกแทนแล้ว";
    default:
      return "ปกติ";
  }
}

function getLineageSummary(record: ProofDatasetRecord) {
  if (record.metadata.revision?.supersedesRecordId) {
    return "รายการนี้เป็นฉบับแก้ใหม่ที่เปิดมาตรวจแทนเคสเดิม";
  }

  if (
    record.metadata.revision?.latestEffectiveRecordId
    && record.metadata.revision.latestEffectiveRecordId !== record.id
  ) {
    return "คิวนี้มีรายการตัวใหม่กว่าสำหรับใช้ตรวจต่อแล้ว";
  }

  return "รายการนี้ยังเป็นเป้าหมายที่ใช้งานอยู่ของคิวปัจจุบัน";
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

function formatPillarCode(stem?: string, branch?: string) {
  if (!stem || !branch) {
    return "-";
  }

  return `${stem}${branch}`;
}

function extractAiStrengthClaim(annotationData: StoredAnnotationDataValue | null) {
  const draftText = [
    annotationData?.reviewSummary,
    annotationData?.sinsaeProofNote,
    ...(annotationData?.dimensions.flatMap((dimension) => [
      dimension.thought_process,
      dimension.final_prediction,
      ...(dimension.supporting_signals ?? []),
      dimension.confidence_note,
    ]) ?? []),
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (!draftText) {
    return null;
  }

  return OPERATOR_STRENGTH_CLASS_BANDS.find((band) => (
    draftText.includes(band.displayLabel) || draftText.includes(band.label)
  )) ?? null;
}

export function ProofWorkspace({ record, returnToPath = "/pending" }: ProofWorkspaceProps) {
  const router = useRouter();
  const initialExpandedDimension = PROOF_WORKSPACE_DIMENSION_ORDER[0];
  const [isCaseContextOpen, setIsCaseContextOpen] = useState(false);
  const [isCalculationOpen, setIsCalculationOpen] = useState(false);
  const [dimensions, setDimensions] = useState<ProofDimensionDraftState>(() =>
    createProofDimensions(record.annotationData),
  );
  const [expandedDimensionName, setExpandedDimensionName] = useState<AnnotationDimensionName | null>(
    initialExpandedDimension,
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
    annotationSummary.completeCount === ACTIVE_RLHF_DIMENSION_NAMES.length
    && sinsaeProofNote.trim().length > 0;
  const canReject = sinsaeProofNote.trim().length > 0;
  const strengthBand = classifyOperatorStrengthScore(record.calculatedState.strengthScore);
  const aiStrengthClaim = extractAiStrengthClaim(record.annotationData);
  const hasStrengthConflict = aiStrengthClaim ? aiStrengthClaim.id !== strengthBand.id : false;
  const mingGongCode = formatPillarCode(
    record.calculatedState.mingGong?.stem,
    record.calculatedState.mingGong?.branch,
  );
  const queueStateCopy = getReviewStateCopy(record.metadata.reviewLifecycle?.state);
  const lineageSummary = getLineageSummary(record);

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
      setSaveErrorMessage("ต้องเติมคำทำนายให้ครบทั้ง 15 มิติและใส่เหตุผลประกอบการตัดสินใจก่อนอนุมัติ");
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

  const proofNoteField = (variantClassName: string) => (
    <label className={`field proof-dock__field ${variantClassName}`}>
      <span>บันทึกของซินแส</span>
      <textarea
        name="sinsae-proof-note"
        rows={4}
        value={sinsaeProofNote}
        placeholder="สรุปเหตุผลที่อนุมัติหรืออธิบายว่าทำไมจึงตีกลับงาน AI"
        onChange={(event) => setSinsaeProofNote(event.target.value)}
      />
    </label>
  );

  return (
    <section className="workspace-stack">
      <section className="surface inset-card proof-hero-card">
        <div>
          <p className="section-kicker">เฟส 5</p>
          <h2>หน้าตรวจทานคำทำนาย AI</h2>
            <p className="annotation-intro">
              อ่านภาพรวมดวง เกลาคำทำนายทั้ง 15 มิติ แล้วปิดงานด้วยการอนุมัติหรือการตีกลับพร้อมเหตุผลในหน้าเดียว
            </p>
        </div>
        <div className="message-card__actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => setIsCaseContextOpen(true)}
          >
            เปิดข้อมูลเคสแบบเต็ม
          </button>
          <Link className="secondary-action pending-link" href={returnToPath}>
            กลับไปคิวรอตรวจ
          </Link>
        </div>
      </section>

      <DetailOverlay
        isOpen={isCaseContextOpen}
        title={record.metadata.customerName ?? `Record ${record.id.slice(0, 8)}`}
        kicker="Expanded Case Context"
        summary="เปิดข้อมูลเคสใน reading sheet ที่กว้างขึ้นเพื่ออ่าน context ก่อนกลับไปตรวจทาน draft ต่อ"
        closeLabel="กลับสู่หน้าตรวจ"
        onClose={() => setIsCaseContextOpen(false)}
      >
        <CaseContextSheet
          customerName={record.metadata.customerName}
          recordId={record.id}
          birthMoment={formatThaiBirthMoment(record.rawInput)}
          province={record.rawInput.province}
          intentDomain={record.intentDomain}
          campaignLabel={record.metadata.generation?.queueBatchId}
          queueStateLabel={queueStateCopy}
          lineageSummary={lineageSummary}
          sourceRow={record.metadata.sourceRow}
          caseNote={record.metadata.caseNote}
          staleReason={record.metadata.reviewLifecycle?.staleReason}
          truthAnchors={[
            { label: "ดิถี", value: record.calculatedState.dayMaster },
            { label: "เสาลัคนา", value: mingGongCode },
            { label: "กำลังดิถี", value: formatScore(record.calculatedState.strengthScore) },
          ]}
          summaryNote="ถือสามค่านี้ไว้ก่อนกลับไปไล่ reasoning ของ AI เพื่อไม่ให้ lost in wording ระหว่างการ proof"
        />
      </DetailOverlay>

      <DetailOverlay
        isOpen={isCalculationOpen}
        title="Calculation Board สำหรับงาน proof"
        kicker="แผงคำนวณสำหรับงานตรวจ"
        summary="เปิดแผงคำนวณแบบเต็มเพื่อเช็กโครงดวง กำลังดิถี และข้อมูลอ้างอิง โดยไม่พา canvas หลักหลุดจากตำแหน่งที่กำลังแก้"
        closeLabel="กลับสู่ canvas"
        panelClassName="explainable-modal--wide"
        onClose={() => setIsCalculationOpen(false)}
      >
        <div className="proof-drawer-stack">
          <section className="surface inset-card proof-summary-card">
            <div className="proof-summary-card__header">
              <div>
                <p className="section-kicker">ค่าหลักที่ถือไว้</p>
                <h3>ถือค่าหลักไว้ก่อน แล้วค่อยไล่ reasoning ในแผงคำนวณ</h3>
              </div>
              <span className="proof-status-badge">{getStatusBadgeCopy(record.status)}</span>
            </div>

            <div className="proof-pill-strip proof-pill-strip--review">
              <div className="proof-pill-chip">
                <span>ดิถี</span>
                <strong>{record.calculatedState.dayMaster}</strong>
              </div>
              <div className="proof-pill-chip">
                <span>เสาลัคนา</span>
                <strong>{mingGongCode}</strong>
              </div>
              <div className="proof-pill-chip">
                <span>กำลังดิถี</span>
                <strong>{formatScore(record.calculatedState.strengthScore)}</strong>
              </div>
            </div>

            <section
              className={`proof-friction-card${hasStrengthConflict ? " proof-friction-card--conflict" : ""}`}
              data-proof-friction={hasStrengthConflict ? "conflict" : aiStrengthClaim ? "aligned" : "missing"}
            >
              <div>
              <p className="section-kicker">ตรวจสอบค่าจริง</p>
              <h4>
                {hasStrengthConflict
                  ? "AI ประเมินกำลังดิถีไม่ตรงกับ ground truth"
                  : aiStrengthClaim
                    ? "ระดับกำลังดิถีใน draft สอดคล้องกับ ground truth"
                    : "ยังไม่มีค่าระดับกำลังดิถีจาก AI ให้เทียบโดยตรง"}
                </h4>
              </div>
              <p className="metric-copy">
                {hasStrengthConflict
                  ? `AI พูดถึงระดับ ${aiStrengthClaim?.displayLabel} แต่ผลจริงของดวงนี้คือ ${strengthBand.displayLabel}`
                  : aiStrengthClaim
                    ? `AI พูดถึงระดับ ${aiStrengthClaim.displayLabel} และตรงกับผลจริงของเคสนี้`
                    : `ผลจริงของเคสนี้คือ ${strengthBand.displayLabel} ส่วนข้อความ draft ยังไม่ได้ระบุระดับไว้ชัดพอ`}
              </p>
            </section>

            <div className="message-card__actions">
              <button
                type="button"
                className="secondary-action pending-link"
                onClick={() => {
                  setIsCalculationOpen(false);
                  setIsCaseContextOpen(true);
                }}
              >
                เปิดข้อมูลเคสคู่ขนาน
              </button>
            </div>
          </section>

          <CalculatedBoard calculatedState={record.calculatedState} />
        </div>
      </DetailOverlay>

      <div className="proof-layout">
        <div className="proof-main proof-main--single">
          <section className="surface inset-card annotation-summary-card">
            <div>
              <p className="section-kicker">ความคืบหน้าการตรวจ</p>
            <h3>เกลาคำทำนายให้ครบทุกมิติ แล้วค่อยตัดสินใจตอนท้าย</h3>
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

            <div className="proof-pill-strip proof-pill-strip--review">
              <div className="proof-pill-chip">
                <span>ดิถี</span>
                <strong>{record.calculatedState.dayMaster}</strong>
              </div>
              <div className="proof-pill-chip">
                <span>เสาลัคนา</span>
                <strong>{mingGongCode}</strong>
              </div>
              <div className="proof-pill-chip">
                <span>กำลังดิถี</span>
                <strong>{formatScore(record.calculatedState.strengthScore)}</strong>
              </div>
            </div>

            <p className="metric-copy">
              ถือสามค่านี้ไว้เป็น anchor หลัก แล้วใช้ปุ่มใน dock เพื่อเปิด calculation board หรือข้อมูลเคสเมื่อจำเป็น
            </p>
          </section>

          <section
            className={`surface inset-card proof-friction-card${hasStrengthConflict ? " proof-friction-card--conflict" : ""}`}
            data-proof-friction={hasStrengthConflict ? "conflict" : aiStrengthClaim ? "aligned" : "missing"}
          >
            <div>
              <p className="section-kicker">Ground Truth Check</p>
              <h4>
                {hasStrengthConflict
                  ? "AI ประเมินกำลังดิถีไม่ตรงกับ ground truth"
                  : aiStrengthClaim
                    ? "ระดับกำลังดิถีใน draft สอดคล้องกับ ground truth"
                    : "ยังไม่มีค่าระดับกำลังดิถีจาก AI ให้เทียบโดยตรง"}
              </h4>
            </div>
            <p className="metric-copy">
              {hasStrengthConflict
                ? `AI พูดถึงระดับ ${aiStrengthClaim?.displayLabel} แต่ผลจริงของดวงนี้คือ ${strengthBand.displayLabel}`
                : aiStrengthClaim
                  ? `AI พูดถึงระดับ ${aiStrengthClaim.displayLabel} และตรงกับผลจริงของเคสนี้`
                  : `ผลจริงของเคสนี้คือ ${strengthBand.displayLabel} ส่วนข้อความ draft ยังไม่ได้ระบุระดับไว้ชัดพอ`}
            </p>
          </section>

          <section className="surface inset-card proof-summary-card">
            <p className="section-kicker">เงื่อนไขการปิดงาน</p>
            <ul className="workflow-list proof-guidance-list">
                <li>อนุมัติได้เมื่อตรวจครบทั้ง 15 มิติและมีเหตุผลประกอบการตัดสินใจ</li>
              <li>ตีกลับได้ทันทีหาก logic ของ AI ผิด แต่ต้องบอกเหตุผลให้ชัด</li>
              <li>ถ้ายังไม่พร้อมปิดงาน สามารถบันทึกความคืบหน้าไว้ก่อน</li>
            </ul>
          </section>

          <div className="accordion-list">
            {PROOF_WORKSPACE_DIMENSION_META.map((dimension, visualStepIndex) => {
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
                    <span className="accordion-index">{String(visualStepIndex + 1).padStart(2, "0")}</span>

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
        </div>
      </div>

      <section className="surface inset-card proof-note-card proof-note-card--mobile">
        <div>
          <p className="section-kicker">บันทึกของซินแส</p>
          <h3>เขียน note ให้จบก่อนค่อยกดปุ่มจาก dock ด้านล่าง</h3>
        </div>
        {proofNoteField("proof-note-card__field")}
      </section>

      <section className="proof-dock" aria-label="proof decision dock">
        <div className="proof-dock__surface surface">
          <div className="proof-dock__header">
            <div>
              <p className="section-kicker">ช่องตัดสินใจ</p>
              <h3>เช็ก note แล้วค่อยอนุมัติหรือตีกลับจาก dock ด้านล่าง</h3>
            </div>
            <p className={`save-indicator save-indicator--${saveState} proof-dock__status`} aria-live="polite">
              {getSaveMessage(saveState, saveErrorMessage, lastSavedAt, activeAction)}
            </p>
          </div>

          <div className="proof-dock__grid">
            {proofNoteField("proof-note-card__field proof-note-card__field--desktop")}

            <div className="proof-dock__side">
              <div className="proof-dock__quick-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsCalculationOpen(true)}
                >
                  เปิดแผงคำนวณ
                </button>

                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => setIsCaseContextOpen(true)}
                >
                  เปิดข้อมูลเคส
                </button>
              </div>

              <div className="proof-action-group proof-action-group--dock">
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
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
