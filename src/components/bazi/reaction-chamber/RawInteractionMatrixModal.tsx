"use client";

import { startTransition, useDeferredValue, useMemo, useState } from "react";

import { DetailOverlay } from "@/components/bazi/DetailOverlay";
import { Badge } from "@/components/bazi/primitives/Badge";
import { Surface } from "@/components/bazi/primitives/Surface";

import type {
  CalculatedStateValue,
  InteractionEntityValue,
  InteractionOutcomeValue,
  InteractionRelationValue,
} from "@/lib/bazi/schema-types";
import { ELEMENT_LABELS_TH, ELEMENT_TH_TO_EN, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";

import {
  SCHOOL_LEXICON_FAMILY_KEY,
  INTERACTION_NARRATIVE_MAP,
} from "@/lib/bazi/lexicon/school-lexicon";
import { SemanticChamberGraph } from "@/lib/bazi/semantic-chamber-graph";

type RawInteractionMatrixModalProps = {
  calculatedState: CalculatedStateValue;
  graph: SemanticChamberGraph;
  isOpen: boolean;
  onClose: () => void;
};

type MatrixRow = {
  id: string;
  from: InteractionEntityValue | undefined;
  to: InteractionEntityValue[];
  type: string;
  direction: string;
  result: string;
  familyKey: string;
  summary: string;
  isOnGraph: boolean;
};

function MatrixParticipantBadge({ entity }: { entity: InteractionEntityValue | undefined }) {
  if (!entity) return <span>-</span>;
  const isStem = !!(STEM_TO_ELEMENT as Record<string, string>)[entity.symbol];
  const elementEn = isStem 
    ? (STEM_TO_ELEMENT as Record<string, string>)[entity.symbol]
    : (BRANCH_TO_ELEMENT as Record<string, string>)[entity.symbol];
  const pillarLabel = entity.pillarKey === "year" ? "ปี"
    : entity.pillarKey === "month" ? "เดือน"
    : entity.pillarKey === "day" ? "ดิถี"
    : entity.pillarKey === "hour" ? "ยาม" : "";
  const side = isStem ? "บน" : "ล่าง";
  return (
    <div className="matrix-participant">
      <Badge className={`text-element-${elementEn} bg-element-${elementEn}/10 border border-element-${elementEn}/20`}>
        {entity.symbol}
      </Badge>
      {pillarLabel && <span className="text-xs text-muted-foreground ml-1">เสา{pillarLabel}({side})</span>}
    </div>
  );
}

function MatrixDirectionArrow({ familyKey }: { familyKey: string }) {
  const isOneWay = familyKey === "element-generate" || familyKey === "element-control";
  return <span className="text-muted-foreground font-mono">{isOneWay ? "---→" : "←→"}</span>;
}

function MatrixGraphStatusBadge({ isOnGraph }: { isOnGraph: boolean }) {
  if (!isOnGraph) return null;
  return <Badge tone="ai" className="text-[10px] py-0 px-1.5 h-4 ml-2 bg-blue-500/10 text-blue-500 border border-blue-500/20">👁️ บนกราฟ</Badge>;
}

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
  const detail = entity.label ?? entity.symbol;

  if (!pillarLabel) {
    return entity.symbol;
  }

  return detail ? `${pillarLabel} · ${entity.symbol} ${detail}` : `${pillarLabel} · ${entity.symbol}`;
}

function resolveTypeLabel(relation: InteractionRelationValue) {
  return SCHOOL_LEXICON_FAMILY_KEY[relation.familyKey] ?? relation.label;
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

  if (outcome?.status === "transformed" && transformLabel) {
    return `หลอมรวมเป็นธาตุ${transformLabel}`;
  }
  if (outcome?.status === "supported") {
    return "ได้รับการส่งเสริม";
  }
  if (outcome?.status === "blocked") {
    return "ถูกสกัดกั้น";
  }
  if (outcome?.status === "transit-broken") {
    return "ปฏิกิริยาไม่สมบูรณ์";
  }

  // Default or "detected" fallback
  if (transformLabel) {
    return `ส่งผลธาตุ${transformLabel}`;
  }
  return "ส่งผลปฏิกิริยา";
}

function buildMatrixRows(calculatedState: CalculatedStateValue, graph: SemanticChamberGraph): MatrixRow[] {
  const interactionState = calculatedState.interactionState;
  if (!interactionState) {
    return [];
  }

  const entityMap = new Map<string, InteractionEntityValue>(interactionState.entities.map((entity) => [entity.id, entity]));
  const outcomeMap = new Map<string, InteractionOutcomeValue>(interactionState.outcomes.map((outcome) => [outcome.relationId, outcome]));
  const activeRelationIds = new Set(graph.edges.map((edge) => edge.data.badge?.sourceRelationId).filter(Boolean));

  return interactionState.relations.map((relation) => {
    const [sourceId, ...targetIds] = relation.participantEntityIds;
    const source = sourceId ? entityMap.get(sourceId) : undefined;
    const targets = targetIds.map((entityId) => entityMap.get(entityId)).filter((entity): entity is InteractionEntityValue => Boolean(entity));
    const fromLabel = source ? resolveEntityLabel(source) : relation.label;
    const toLabel = targets.length > 0 ? targets.map(resolveEntityLabel).join(" + ") : "-";
    const type = resolveTypeLabel(relation);
    const direction = resolveDirectionLabel(relation);
    const result = resolveOutcomeLabel(relation, outcomeMap.get(relation.id));
    const isOnGraph = activeRelationIds.has(relation.id);
    return {
      id: relation.id,
      from: source,
      to: targets,
      type,
      direction,
      result,
      familyKey: relation.familyKey,
      summary: `${fromLabel} ${type} ${toLabel} ${result}`,
      isOnGraph,
    };
  });
}

export function RawInteractionMatrixModal({ calculatedState, graph, isOpen, onClose }: RawInteractionMatrixModalProps) {
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("all");
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const rows = useMemo(() => buildMatrixRows(calculatedState, graph), [calculatedState, graph]);
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
      return `${row.summary} ${row.direction}`.toLowerCase().includes(deferredSearch);
    });
  }, [deferredSearch, familyFilter, rows]);

  return (
    <DetailOverlay
      isOpen={isOpen}
      title="ตารางปฏิกิริยาทั้งหมด"
      kicker="ข้อมูลจากระบบ"
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
                  <option key={family} value={family}>{SCHOOL_LEXICON_FAMILY_KEY[family] ?? family}</option>
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
                <span role="cell" className="flex items-center gap-1">
                  <MatrixParticipantBadge entity={row.from} />
                  <MatrixGraphStatusBadge isOnGraph={row.isOnGraph} />
                </span>
                <span role="cell" className="flex items-center gap-1">
                  {row.to.length > 0 
                    ? row.to.map((target) => <MatrixParticipantBadge key={target.id} entity={target} />)
                    : <span>-</span>
                  }
                </span>
                <span role="cell">
                  <div className="font-medium">{row.type}</div>
                </span>
                <span role="cell" className="text-center">
                  <MatrixDirectionArrow familyKey={row.familyKey} />
                </span>
                <span role="cell">
                  <div className="font-medium">{INTERACTION_NARRATIVE_MAP[row.familyKey] ?? "-"}</div>
                  <div className="text-xs text-muted-foreground">({row.result})</div>
                </span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </DetailOverlay>
  );
}
