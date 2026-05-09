"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { DetailOverlay } from "@/components/bazi/DetailOverlay";
import { Badge } from "@/components/bazi/primitives/Badge";
import { Surface } from "@/components/bazi/primitives/Surface";
import { getSchoolLexiconInteraction } from "@/lib/bazi/lexicon/school-lexicon";
import type {
  CalculatedStateValue,
  InteractionEntityValue,
  InteractionOutcomeValue,
  InteractionRelationValue,
} from "@/lib/bazi/schema-types";
import { BRANCH_LABELS_TH, ELEMENT_LABELS_TH, ELEMENT_TH_TO_EN } from "@/lib/bazi/symbolic-engine.constants";

type RawInteractionMatrixModalProps = {
  calculatedState: CalculatedStateValue;
  isOpen: boolean;
  onClose: () => void;
};

type MatrixRow = {
  id: string;
  from: string;
  to: string;
  type: string;
  direction: string;
  result: string;
  familyKey: string;
  summary: string;
};

function resolveEntityLabel(entity: InteractionEntityValue) {
  const pillarLabel = entity.pillarKey === "year"
    ? "ปี"
    : entity.pillarKey === "month"
      ? "เดือน"
      : entity.pillarKey === "day"
        ? "ดิถี"
        : entity.pillarKey === "hour"
          ? "ยาม"
          : "";
  const branchLabel = BRANCH_LABELS_TH[entity.symbol as keyof typeof BRANCH_LABELS_TH];
  const detail = entity.label ?? branchLabel;

  if (!pillarLabel) {
    return entity.symbol;
  }

  return detail ? `${pillarLabel} · ${entity.symbol} ${detail}` : `${pillarLabel} · ${entity.symbol}`;
}

function resolveTypeLabel(relation: InteractionRelationValue) {
  if (relation.familyKey === "heavenly-stem-he") return "ภาคีราศีบน";
  if (relation.familyKey === "heavenly-stem-clash") return "ชงราศีบน";
  if (relation.familyKey === "earthly-branch-liu-he") return "ฮะราศีล่าง";
  if (relation.familyKey === "earthly-branch-san-he") return "ซาฮะ";
  if (relation.familyKey === "earthly-branch-ban-san-he") return "ครึ่งซาฮะ";
  if (relation.familyKey === "earthly-branch-clash") return "ชง";
  if (relation.familyKey === "earthly-branch-harm") return "ไห่";
  if (relation.familyKey === "earthly-branch-destruction") return "ผั่ว";
  if (relation.familyKey === "earthly-branch-punishment") return "เฮ้ง";
  if (relation.familyKey === "element-generate") return getSchoolLexiconInteraction("generate");
  if (relation.familyKey === "element-control") return getSchoolLexiconInteraction("control");
  return relation.label;
}

function resolveDirectionLabel(relation: InteractionRelationValue) {
  if (relation.familyKey === "element-generate") {
    return "→ ทางเดียว";
  }
  if (relation.familyKey === "element-control") {
    return "→ ทางเดียว";
  }
  return "↔ สองทาง";
}

function resolveOutcomeLabel(relation: InteractionRelationValue, outcome: InteractionOutcomeValue | undefined) {
  const transformElement = outcome?.transformElement ?? relation.transformElement;
  const transformLabel = transformElement
    ? ELEMENT_LABELS_TH[ELEMENT_TH_TO_EN[transformElement] as keyof typeof ELEMENT_LABELS_TH] ?? transformElement
    : null;

  const statusLabel = outcome?.status === "transformed"
    ? "แปรธาตุสำเร็จ"
    : outcome?.status === "supported"
      ? "ได้แรงหนุน"
      : outcome?.status === "blocked"
        ? "ถูกขวาง"
        : outcome?.status === "transit-broken"
          ? "แตกกลางทาง"
          : outcome?.status === "detected"
            ? "ตรวจพบ"
            : "-";

  if (transformLabel) {
    return `${statusLabel} · ${transformLabel}`;
  }

  return statusLabel;
}

function buildMatrixRows(calculatedState: CalculatedStateValue): MatrixRow[] {
  const interactionState = calculatedState.interactionState;
  if (!interactionState) {
    return [];
  }

  const entityMap = new Map<string, InteractionEntityValue>(interactionState.entities.map((entity) => [entity.id, entity]));
  const outcomeMap = new Map<string, InteractionOutcomeValue>(interactionState.outcomes.map((outcome) => [outcome.relationId, outcome]));

  return interactionState.relations.map((relation) => {
    const [sourceId, ...targetIds] = relation.participantEntityIds;
    const source = sourceId ? entityMap.get(sourceId) : undefined;
    const targets = targetIds.map((entityId) => entityMap.get(entityId)).filter((entity): entity is InteractionEntityValue => Boolean(entity));
    const from = source ? resolveEntityLabel(source) : relation.label;
    const to = targets.length > 0 ? targets.map(resolveEntityLabel).join(" + ") : "-";
    const type = resolveTypeLabel(relation);
    const direction = resolveDirectionLabel(relation);
    const result = resolveOutcomeLabel(relation, outcomeMap.get(relation.id));
    return {
      id: relation.id,
      from,
      to,
      type,
      direction,
      result,
      familyKey: relation.familyKey,
      summary: `${from} ${type} ${to} ${result}`,
    };
  });
}

export function RawInteractionMatrixModal({ calculatedState, isOpen, onClose }: RawInteractionMatrixModalProps) {
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const rows = useMemo(() => buildMatrixRows(calculatedState), [calculatedState]);
  const families = useMemo(
    () => Array.from(new Set(rows.map((row) => row.familyKey))).sort(),
    [rows],
  );
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (familyFilter !== "all" && row.familyKey !== familyFilter) {
        return false;
      }
      if (!deferredSearch) {
        return true;
      }
      return `${row.from} ${row.to} ${row.type} ${row.result} ${row.direction}`.toLowerCase().includes(deferredSearch);
    });
  }, [deferredSearch, familyFilter, rows]);

  return (
    <DetailOverlay
      isOpen={isOpen}
      title="ตารางปฏิกิริยาทั้งหมด"
      kicker="Engine Truth"
      summary={`แสดงปฏิกิริยาที่ engine คำนวณได้ทั้งหมด ${rows.length} เส้น โดยไม่ผ่าน quiet graph filter`}
      closeLabel="ปิด"
      panelClassName="explainable-modal--wide chamber-detail-modal"
      onClose={onClose}
      footer={<Badge>{filteredRows.length} / {rows.length} รายการ</Badge>}
    >
      <div className="chamber-matrix">
        <Surface className="chamber-matrix__filters">
          <div className="field-grid">
            <label className="field">
              <span>ค้นหาเร็ว</span>
              <input
                value={search}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  startTransition(() => setSearch(nextValue));
                }}
                placeholder="ค้นหาเสา ประเภท หรือผลลัพธ์"
              />
            </label>
            <label className="field">
              <span>กรองตามตระกูล</span>
              <select value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
                <option value="all">ทั้งหมด</option>
                {families.map((family) => (
                  <option key={family} value={family}>{family}</option>
                ))}
              </select>
            </label>
          </div>
        </Surface>

        <Surface className="chamber-matrix__table-shell">
          <div className="chamber-matrix__table" role="table" aria-label="ตารางปฏิกิริยาทั้งหมด">
            <div className="chamber-matrix__row chamber-matrix__row--head" role="row">
              <span role="columnheader">จาก</span>
              <span role="columnheader">ไปหา</span>
              <span role="columnheader">ประเภท</span>
              <span role="columnheader">ทิศทาง</span>
              <span role="columnheader">ผล</span>
            </div>
            {filteredRows.map((row) => (
              <div key={row.id} className="chamber-matrix__row" role="row">
                <span role="cell">{row.from}</span>
                <span role="cell">{row.to}</span>
                <span role="cell">{row.type}</span>
                <span role="cell">{row.direction}</span>
                <span role="cell">{row.result}</span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </DetailOverlay>
  );
}
