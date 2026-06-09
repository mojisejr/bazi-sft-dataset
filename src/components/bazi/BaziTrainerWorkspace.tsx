"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  getAnnotationDraftContentState,
  getAnnotationProgressSummary,
  isAnnotationReadyForReview,
  useAnnotationStore,
} from "@/lib/bazi/annotation-store";

import { AnnotationWorkspace } from "@/components/bazi/AnnotationWorkspace";
import { BirthForm } from "@/components/bazi/BirthForm";
import { ActionLink } from "@/components/bazi/primitives/Action";
import { CalculatedBoard } from "@/components/bazi/CalculatedBoard";
import { PendingDraftQueue } from "@/components/bazi/PendingDraftQueue";
import { SystemHeader } from "@/components/bazi/SystemHeader";
import { useBaziCalculate } from "@/hooks/bazi/useBaziCalculate";
import { useDatasetPersistence } from "@/hooks/bazi/useDatasetPersistence";
import type { PendingDraftDatasetRecord } from "@/lib/bazi/dataset-records";
import {
  getResetActionCopy,
  getStatusCopy,
  type BaziTrainerWorkspaceProps,
} from "@/lib/bazi/trainer-workspace";

export type WorkspaceMode = "manual" | "queue";

type BaziTrainerWorkspaceClientProps = BaziTrainerWorkspaceProps & {
  initialWorkspace?: WorkspaceMode;
};

function getWorkspaceStatusCopy(
  activeWorkspace: WorkspaceMode,
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

function getCampaignLabel(searchParams: URLSearchParams) {
  const candidate = searchParams.get("campaign")?.trim();
  return candidate ? candidate : undefined;
}

function buildQueueWorkspaceUrl(pathname: string, campaignLabel?: string) {
  const params = new URLSearchParams({ workspace: "queue" });

  if (campaignLabel) {
    params.set("campaign", campaignLabel);
  }

  return `${pathname}?${params.toString()}`;
}

export function BaziTrainerWorkspace({
  initialFormState,
  initialSubmittedInput = null,
  initialCalculatedState = null,
  initialSubmissionState = "idle",
  initialWorkspace = "manual",
}: BaziTrainerWorkspaceClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceMode>(initialWorkspace);
  // กัน hydration mismatch: หน้านี้พึ่ง client store (zustand) + Clerk ซึ่ง state อาจไม่ตรง SSR
  // จึง render เฉพาะหลัง mount (SSR และ client-first-render เป็น shell เดียวกัน → hydrate ตรงเสมอ)
  const [hasMounted, setHasMounted] = useState(false);
  const [pendingDraftRecords, setPendingDraftRecords] = useState<PendingDraftDatasetRecord[]>([]);
  const [pendingQueueReloadToken, setPendingQueueReloadToken] = useState(0);
  const [pendingQueueState, setPendingQueueState] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [pendingQueueError, setPendingQueueError] = useState<string | null>(null);

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

  useEffect(() => {
    setHasMounted(true);
  }, []);
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
  const campaignLabel = getCampaignLabel(searchParams);

  useEffect(() => {
    setActiveWorkspace(initialWorkspace);
  }, [initialWorkspace]);

  function handleWorkspaceChange(nextWorkspace: WorkspaceMode) {
    setActiveWorkspace(nextWorkspace);

    const nextUrl = nextWorkspace === "queue"
      ? buildQueueWorkspaceUrl(pathname, campaignLabel)
      : pathname;

    router.replace(nextUrl, { scroll: false });
  }

  useEffect(() => {
    if (activeWorkspace !== "queue") {
      return;
    }

    const controller = new AbortController();
    let isActive = true;

    async function loadDraftQueue() {
      setPendingQueueState("loading");
      setPendingQueueError(null);

      try {
        const queueUrl = campaignLabel
          ? `/api/dataset/drafts?campaign=${encodeURIComponent(campaignLabel)}`
          : "/api/dataset/drafts";
        const response = await fetch(queueUrl, {
          method: "GET",
          headers: {
            accept: "application/json",
          },
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await response.json()) as PendingDraftDatasetRecord[] | { error?: string };

        if (!response.ok) {
          throw new Error(
            Array.isArray(body) ? "ยังไม่สามารถโหลด draft queue ได้ในตอนนี้" : body.error ?? "ยังไม่สามารถโหลด draft queue ได้ในตอนนี้",
          );
        }

        if (!isActive) {
          return;
        }

        setPendingDraftRecords(Array.isArray(body) ? body : []);
        setPendingQueueState("ready");
      } catch (error) {
        if (!isActive || controller.signal.aborted) {
          return;
        }

        setPendingQueueError(
          error instanceof Error ? error.message : "ยังไม่สามารถโหลด draft queue ได้ในตอนนี้",
        );
        setPendingQueueState("error");
      }
    }

    void loadDraftQueue();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [activeWorkspace, campaignLabel, pendingQueueReloadToken]);

  if (!hasMounted) {
    return <main className="trainer-page" aria-busy="true" />;
  }

  return (
    <main className="trainer-page">
      <SystemHeader statusCopy={workspaceStatusCopy} />

      <section className="reading-cta">
        <div className="reading-cta__copy">
          <p className="section-kicker">คำทำนายเชิงลึก</p>
          <p className="reading-cta__title">อ่านดวงแบบทีละบท 15 หัวข้อ</p>
        </div>
        <ActionLink href="/reading" tone="primary" className="reading-cta__action">
          ไปหน้าคำทำนาย 15 บท →
        </ActionLink>
        <ActionLink href="/pair-matching" tone="secondary" className="reading-cta__action">
          เปรียบเทียบคู่รัก (คู่สมพงษ์) →
        </ActionLink>
        <ActionLink href="/work-matching" tone="secondary" className="reading-cta__action">
          เปรียบเทียบการงาน (สูงสุด 3 คน) →
        </ActionLink>
      </section>

      <section className="workspace-switch-shell">
        <div className="workspace-switch" role="tablist" aria-label="workspace mode switch">
          <div className="workspace-switch__backdrop" aria-hidden="true" />
          <div className="workspace-switch__rail">
            <button
              type="button"
              onClick={() => handleWorkspaceChange("manual")}
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
              onClick={() => handleWorkspaceChange("queue")}
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
        <div className={`manual-workspace${calculatedState ? " manual-workspace--ready" : ""}`}>
          <section className="surface intake-stage">
            <BirthForm
              formState={formState}
              submittedInput={submittedInput}
              isSessionLocked={isSessionLocked}
              submissionState={submissionState}
              resetActionCopy={resetActionCopy}
              onFieldChange={handleFieldChange}
              onSubmit={(event) => handleSubmit(event, { onBeforeApplyResult: beginNewSession })}
              onReset={() => handleReset(resetCalculationSession)}
            />
          </section>

          <section className="workspace-stack">
            <CalculatedBoard calculatedState={calculatedState} />

            {false && calculatedState && (
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
        </div>
      )}

      {activeWorkspace === "queue" && (
        <section className="workspace-stack px-4 pb-10 pt-2">
          {pendingQueueState === "ready" ? (
            <PendingDraftQueue
              records={pendingDraftRecords}
              campaignLabel={campaignLabel}
              returnToPath={buildQueueWorkspaceUrl(pathname, campaignLabel)}
            />
          ) : (
            <div className="surface inset-card message-card">
              <p className="section-kicker">พื้นที่งานคิวตรวจ</p>
              <h3>
                {pendingQueueState === "error"
                  ? "ยังโหลด draft queue ไม่สำเร็จ"
                  : "กำลังโหลด draft queue จากฐานข้อมูล"}
              </h3>
              <p>
                {pendingQueueState === "error"
                  ? pendingQueueError ?? "ลองใหม่อีกครั้งเมื่อระบบเชื่อมต่อฐานข้อมูลพร้อม"
                  : "กำลังดึงรายการ draft ที่ AI generate ไว้แล้วเพื่อให้ซินแสเปิด proof ต่อได้ทันที"}
              </p>
              {pendingQueueState === "error" && (
                <div className="message-card__actions">
                  <button
                    type="button"
                    className="secondary-action pending-link"
                    onClick={() => setPendingQueueReloadToken((current) => current + 1)}
                  >
                    ลองโหลดคิวอีกครั้ง
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </main>
  );
}