"use client";

import { StatusChip } from "@/components/bazi/primitives/StatusChip";
import { Surface } from "@/components/bazi/primitives/Surface";
import type { StatusCopy } from "@/lib/bazi/trainer-workspace";

type SystemHeaderProps = {
  statusCopy: StatusCopy;
};

export function SystemHeader({ statusCopy }: SystemHeaderProps) {
  return (
    <Surface as="section" className="trainer-header">
      <div className="brand-lockup">
        <p className="brand-mark">Bazi Trainer</p>
        <h1>Bazi Trainer that makes ซินแส ซินแส !</h1>
        <p className="brand-story">
          พื้นที่ทำงานที่พาเรื่องยากให้ไหลลื่น ตั้งข้อมูลให้ชัด คำนวณให้ตรง แล้วอ่านภาพรวมได้ทันที
          แบบเรียบง่ายแต่มั่นคง
        </p>
      </div>

      <div className="header-sidebar">
        <div className="status-stack">
          <StatusChip tone={statusCopy.tone}>{statusCopy.label}</StatusChip>
          <p className="status-detail">{statusCopy.detail}</p>
        </div>
      </div>
    </Surface>
  );
}