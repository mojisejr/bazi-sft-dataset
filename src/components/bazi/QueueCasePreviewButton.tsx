"use client";

import { useState } from "react";

import { ActionButton, ActionLink } from "@/components/bazi/primitives/Action";
import { CaseContextSheet } from "@/components/bazi/CaseContextSheet";
import { DetailOverlay } from "@/components/bazi/DetailOverlay";

type QueueCasePreviewButtonProps = {
  customerName?: string | null;
  recordId: string;
  birthMoment: string;
  intentDomain: string;
  campaignLabel?: string | null;
  queueStateLabel: string;
  lineageSummary: string;
  sourceRow?: number | null;
  caseNote?: string | null;
  staleReason?: string | null;
  proofHref: string;
};

export function QueueCasePreviewButton({
  customerName,
  recordId,
  birthMoment,
  intentDomain,
  campaignLabel,
  queueStateLabel,
  lineageSummary,
  sourceRow,
  caseNote,
  staleReason,
  proofHref,
}: QueueCasePreviewButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <ActionButton type="button" className="pending-link" onClick={() => setIsOpen(true)}>
        อ่านก่อนตรวจ
      </ActionButton>

      <DetailOverlay
        isOpen={isOpen}
        title={customerName ?? `Record ${recordId.slice(0, 8)}`}
        kicker="Case Preview"
        summary="เปิดอ่านข้อมูลเคสใน canvas ที่กว้างขึ้นก่อนเข้าสู่ proof เพื่อไม่ให้ context ถูกบีบอยู่ในแถวคิว"
        closeLabel="กลับสู่คิว"
        onClose={() => setIsOpen(false)}
        footer={(
          <div className="message-card__actions">
            <ActionButton type="button" onClick={() => setIsOpen(false)}>กลับสู่คิว</ActionButton>
            <ActionLink tone="primary" className="pending-link" href={proofHref}>ตรวจเคสนี้ต่อ</ActionLink>
          </div>
        )}
      >
        <CaseContextSheet
          customerName={customerName}
          recordId={recordId}
          birthMoment={birthMoment}
          intentDomain={intentDomain}
          campaignLabel={campaignLabel}
          queueStateLabel={queueStateLabel}
          lineageSummary={lineageSummary}
          sourceRow={sourceRow}
          caseNote={caseNote}
          staleReason={staleReason}
        />
      </DetailOverlay>
    </>
  );
}