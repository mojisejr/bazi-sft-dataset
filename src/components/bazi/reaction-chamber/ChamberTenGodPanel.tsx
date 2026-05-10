"use client";

import { Badge } from "@/components/bazi/primitives/Badge";
import { Surface } from "@/components/bazi/primitives/Surface";
import { DetailOverlay } from "@/components/bazi/DetailOverlay";
import type { CalculatedStateValue } from "@/lib/bazi/schema-types";
import {
  CONTROLS,
  ELEMENT_COLORS_TH,
  ELEMENT_LABELS_TH,
  GENERATES,
  STEM_TO_ELEMENT,
  BRANCH_TO_ELEMENT,
} from "@/lib/bazi/symbolic-engine.constants";

type ChamberTenGodPanelProps = {
  calculatedState: CalculatedStateValue;
  isOpen: boolean;
  onClose: () => void;
};

type RoleSummaryRow = {
  label: string;
  element: string;
  description: string;
  symbols: string[];
};

function resolveElementForRole(dayMasterElement: keyof typeof GENERATES, role: RoleSummaryRow["label"]) {
  if (role === "ดิถี" || role === "คู่ธาตุ") {
    return dayMasterElement;
  }
  if (role === "ถ่ายเท") {
    return GENERATES[dayMasterElement];
  }
  if (role === "โชคลาภ") {
    return CONTROLS[dayMasterElement];
  }
  if (role === "พิฆาต") {
    return Object.entries(CONTROLS).find(([, target]) => target === dayMasterElement)?.[0] as keyof typeof GENERATES;
  }
  return Object.entries(GENERATES).find(([, target]) => target === dayMasterElement)?.[0] as keyof typeof GENERATES;
}

function buildPresentElementSymbols(calculatedState: CalculatedStateValue) {
  const symbolMap = new Map<string, string[]>();

  for (const pillar of Object.values(calculatedState.fourPillars)) {
    const stemElement = STEM_TO_ELEMENT[pillar.stem as keyof typeof STEM_TO_ELEMENT];
    const branchElement = BRANCH_TO_ELEMENT[pillar.branch as keyof typeof BRANCH_TO_ELEMENT];

    if (stemElement) {
      symbolMap.set(stemElement, [...(symbolMap.get(stemElement) ?? []), pillar.stem]);
    }
    if (branchElement) {
      symbolMap.set(branchElement, [...(symbolMap.get(branchElement) ?? []), pillar.branch]);
    }
  }

  return symbolMap;
}

function buildRoleRows(calculatedState: CalculatedStateValue): RoleSummaryRow[] {
  const dayMasterElement = STEM_TO_ELEMENT[calculatedState.dayMaster as keyof typeof STEM_TO_ELEMENT] as keyof typeof GENERATES | undefined;
  if (!dayMasterElement) {
    return [];
  }

  const presentElementSymbols = buildPresentElementSymbols(calculatedState);
  const roleDescriptions: Record<string, string> = {
    "ดิถี": "ธาตุหลักของเจ้าชะตา ใช้เป็นแกนอ่านทั้งดวง",
    "คู่ธาตุ": "พวกเดียวกัน คนร่วมแรง คู่แข่ง หรือแรงแชร์พลัง",
    "ถ่ายเท": "สิ่งที่ดิถีปล่อยออกไปเป็นผลงาน ความคิด และการแสดงออก",
    "โชคลาภ": "ทรัพย์ โอกาส ผลตอบแทน และสิ่งที่ดิถีไปครอบครอง",
    "พิฆาต": "แรงกด อำนาจ ระเบียบ หรือแรงที่มาคุมดิถี",
    "ส่งเสริม": "แรงหนุน ผู้ใหญ่ ความรู้ และสิ่งที่หล่อเลี้ยงดิถี",
  };

  return ["ดิถี", "คู่ธาตุ", "ถ่ายเท", "โชคลาภ", "พิฆาต", "ส่งเสริม"].map((role) => {
    const element = resolveElementForRole(dayMasterElement, role);
    return {
      label: role,
      element,
      description: roleDescriptions[role],
      symbols: presentElementSymbols.get(element) ?? [],
    };
  });
}

export function ChamberTenGodPanel({ calculatedState, isOpen, onClose }: ChamberTenGodPanelProps) {
  const roleRows = buildRoleRows(calculatedState);
  const dayMasterElement = STEM_TO_ELEMENT[calculatedState.dayMaster as keyof typeof STEM_TO_ELEMENT] as keyof typeof ELEMENT_LABELS_TH | undefined;

  return (
    <DetailOverlay
      isOpen={isOpen}
      title="สรุปบทบาทธาตุ"
      kicker="บันทึกซินแส"
      summary={dayMasterElement
        ? `ดิถี ${calculatedState.dayMaster} เป็นธาตุ${ELEMENT_LABELS_TH[dayMasterElement]} แยกอ่านเป็น คู่ธาตุ ถ่ายเท โชคลาภ พิฆาต และส่งเสริม`
        : undefined}
      closeLabel="ปิด"
      panelClassName="explainable-modal--wide chamber-detail-modal"
      onClose={onClose}
    >
      <div className="chamber-role-summary">
        <Surface className="chamber-role-summary__card">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="section-kicker">ผังบทบาทธาตุ</p>
              <h3>อ่านดวงแบบสรุปก่อนลงกราฟ</h3>
            </div>
            <Badge>ดิถี {calculatedState.dayMaster}</Badge>
          </div>

          <div className="chamber-role-summary__table" role="table" aria-label="สรุปบทบาทธาตุ">
            <div className="chamber-role-summary__row chamber-role-summary__row--head" role="row">
              <span role="columnheader">บทบาท</span>
              <span role="columnheader">ธาตุ</span>
              <span role="columnheader">ตัวที่มีในดวง</span>
              <span role="columnheader">ความหมาย</span>
            </div>
            {roleRows.map((row) => {
              const thaiElement = ELEMENT_LABELS_TH[row.element as keyof typeof ELEMENT_LABELS_TH] ?? row.element;
              return (
                <div key={row.label} className="chamber-role-summary__row" role="row">
                  <strong role="cell">{row.label}</strong>
                  <span role="cell" className="chamber-role-summary__element" style={{ color: ELEMENT_COLORS_TH[thaiElement] }}>
                    {thaiElement}
                  </span>
                  <span role="cell">{row.symbols.length > 0 ? row.symbols.join(" · ") : "ไม่มี"}</span>
                  <span role="cell">{row.description}</span>
                </div>
              );
            })}
          </div>
        </Surface>
      </div>
    </DetailOverlay>
  );
}
