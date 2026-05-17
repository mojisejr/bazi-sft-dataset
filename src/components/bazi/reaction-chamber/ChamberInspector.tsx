"use client";

import { motion, AnimatePresence } from "motion/react";

import type { RelationReadingPacket } from "@/lib/bazi/day-master-relation-reading-poc";
import type {
  BaseChartReactionBadgeValue,
} from "@/lib/bazi/schema-types";
import type { ChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
import type { SemanticEdge, SemanticNode } from "@/lib/bazi/semantic-chamber-graph";

import type { ChamberSelection } from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";
import { ELEMENT_COLORS_TH, ELEMENT_LABELS_TH, STEM_TO_ELEMENT, BRANCH_TO_ELEMENT } from "@/lib/bazi/symbolic-engine.constants";
import {
  getSchoolLexiconFamilyKey,
  translatePriority,
  translateOutcomeStatus,
  translateOutcomeDetail,
  translateRelationType,
  translateBundleDirection,
  FLOW_CYCLE_MAP,
  FLOW_DIRECTION_MAP,
  BADGE_FAMILY_MAP,
  PILLAR_CONTEXT_SHORT,
  PILLAR_LABEL_MAP,
} from "@/lib/bazi/lexicon/school-lexicon";

const PILLAR_CONTEXT_TH: Record<string, string> = {
  year: "บรรพบุรุษ / ตลาด / ลูกค้า / วัยเด็ก",
  month: "พ่อแม่ / ผู้บังคับบัญชา / สังคมการงาน",
  day: "ดิถี / คู่ครอง / บ้าน / ชีวิตส่วนตัว",
  time: "ลูกหลาน / ลูกน้อง / บั้นปลายชีวิต / ผลงาน",
};

function resolveFamilyLabel(badge: BaseChartReactionBadgeValue): string {
  if (badge.sourceFamilyKey) {
    return getSchoolLexiconFamilyKey(badge.sourceFamilyKey);
  }
  return BADGE_FAMILY_MAP[badge.family] ?? badge.family;
}

type ChamberInspectorProps = {
  selection: ChamberSelection;
  relationBundle: ChamberRelationBundle | null;
  readingPacket: RelationReadingPacket | null;
  variant: "docked" | "sheet";
  onClose: () => void;
};

type PacketStep = RelationReadingPacket["stepInsights"][number];

function findPacketStepForSelection(
  selection: ChamberSelection,
  packet: RelationReadingPacket | null,
): PacketStep | null {
  if (!packet || !selection.primary) {
    return null;
  }

  if (selection.primary.kind === "edge") {
    const badge = selection.primary.edge.data.badge;
    const family = badge.family.toLowerCase();
    if (family.includes("marker") || badge.doctrineKey?.startsWith("marker:")) {
      return packet.stepInsights.find((step) => step.stepNumber === 6) ?? null;
    }
    if (family.includes("ten-god") || badge.doctrineKey?.startsWith("ten-god:")) {
      return packet.stepInsights.find((step) => step.stepNumber === 3) ?? null;
    }
    if (family.includes("wealth")) {
      return packet.stepInsights.find((step) => step.stepNumber === 4) ?? null;
    }
    if (family.includes("interaction") || family.includes("branch") || family.includes("stem")) {
      return packet.stepInsights.find((step) => step.stepNumber === 5) ?? null;
    }
  }

  if (selection.primary.kind === "node") {
    const node = selection.primary.node;
    if (node.data.kind === "stem-node" && node.data.pillarKey === "day") {
      return packet.stepInsights.find((step) => step.stepNumber === 2) ?? null;
    }
    if (node.data.kind === "stem-node") {
      return packet.stepInsights.find((step) => step.stepNumber === 3) ?? null;
    }
    if (node.data.kind === "branch-node") {
      return packet.stepInsights.find((step) => step.stepNumber === 5) ?? null;
    }
    if (node.data.kind === "pillar") {
      return packet.stepInsights.find((step) => step.stepNumber === 1) ?? null;
    }
  }

  return packet.stepInsights[0] ?? null;
}

function PacketReadingCard({ step, packet }: { step: PacketStep; packet: RelationReadingPacket }) {
  const evidenceDetails = packet.evidenceCatalog.filter((entry) => step.evidenceIds.includes(entry.id));

  return (
    <section className="chamber-inspector__packet-card">
      <p className="chamber-inspector__section-title">คำอธิบายตามลำดับสำนัก</p>
      <p className="chamber-inspector__packet-step">Step {step.stepNumber} · {step.titleThai}</p>
      <p className="chamber-inspector__summary">{step.summaryThai}</p>
      <div className="chamber-inspector__packet-block">
        <p className="chamber-inspector__section-title">จุดที่ใช้ตรวจ</p>
        <p className="chamber-inspector__explanation">{step.auditFocusThai}</p>
      </div>
      {evidenceDetails.length > 0 && (
        <div className="chamber-inspector__participants">
          <p className="chamber-inspector__section-title">หลักฐานที่อ้าง</p>
          <ul>
            {evidenceDetails.map((entry) => (
              <li key={entry.id}>{entry.labelThai} · {entry.detailThai}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function getBadgeFromSelection(selection: ChamberSelection): BaseChartReactionBadgeValue | null {
  if (!selection.primary) {
    return null;
  }

  if (selection.primary.kind === "edge") {
    return selection.primary.edge.data.badge;
  }

  if (selection.primary.kind === "node" && selection.primary.node.data.kind === "marker") {
    return selection.primary.node.data.badge;
  }

  return null;
}

function PillarSummary({ node }: { node: SemanticNode }) {
  if (node.data.kind !== "pillar") {
    return null;
  }

  const data = node.data;
  const stemElement = STEM_TO_ELEMENT[data.stem as keyof typeof STEM_TO_ELEMENT] ?? "ไม้";
  const branchElement = BRANCH_TO_ELEMENT[data.branch as keyof typeof BRANCH_TO_ELEMENT] ?? "ไม้";

  return (
    <div className="chamber-inspector__pillar">
      <p className="chamber-inspector__kicker">{data.pillarLabel}{data.isFocal ? " · ดิถี" : ""}</p>
      <div className="chamber-inspector__glyphs">
        <span style={{ color: ELEMENT_COLORS_TH[stemElement] }}>{data.stem}</span>
        <span style={{ color: ELEMENT_COLORS_TH[branchElement] }}>{data.branch}</span>
      </div>
      {(data.stemTranslation || data.branchTranslation) && (
        <p className="chamber-inspector__translation">
          {[data.stemTranslation, data.branchTranslation].filter(Boolean).join(" / ")}
        </p>
      )}
      {data.pillarKey && PILLAR_CONTEXT_TH[data.pillarKey] && (
        <p className="chamber-inspector__explanation">
          <strong>บริบท:</strong> {PILLAR_CONTEXT_TH[data.pillarKey]}
        </p>
      )}
      {data.stageSlots.length > 0 && (
        <div className="chamber-inspector__stage-grid">
          <p className="chamber-inspector__section-title">โครงสร้างพื้นดวง</p>
          <dl>
            {data.stageSlots.map((slot) => (
              <div key={`${slot.source}-${slot.value}`} className="chamber-inspector__detail-row">
                <dt>{slot.label}</dt>
                <dd>{slot.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {data.meaningSlots.length > 0 ? (
        <div className="chamber-inspector__roles">
          <p className="chamber-inspector__section-title">ดิถีมองเสานี้</p>
          <ul>
            {data.meaningSlots.map((slot) => (
              <li key={slot.badge.id}>
                <span className={`chamber-inspector__role-chip chamber-inspector__role-chip--${slot.badge.status}`}>
                  {slot.source === "stem" ? "ราศีบน" : "ราศีล่าง"} · {slot.relationLabel}
                </span>
                <span className="chamber-inspector__role-meaning">{slot.meaningShort}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="chamber-inspector__empty">เสานี้ยังไม่มีรายการบทบาทเด่นในดวงนี้</p>
      )}
    </div>
  );
}

function SemanticNodeSummary({ node }: { node: SemanticNode }) {
  if (node.data.kind !== "stem-node" && node.data.kind !== "branch-node") {
    return null;
  }

  const symbol = node.data.kind === "stem-node" ? node.data.stem : node.data.branch;
  const translation = node.data.kind === "stem-node"
    ? (node.data.stemTranslation ?? ELEMENT_LABELS_TH[node.data.element as keyof typeof ELEMENT_LABELS_TH] ?? node.data.element)
    : (node.data.branchTranslation ?? ELEMENT_LABELS_TH[node.data.element as keyof typeof ELEMENT_LABELS_TH] ?? node.data.element);
  const semanticRole = node.data.kind === "stem-node" ? "ราศีบน" : "ราศีล่าง";
  const detailLabel = node.data.kind === "stem-node" ? "จับซิ้ง" : "12 เชี่ยงแซ";
  const detailValue = node.data.kind === "stem-node" ? (node.data.tenGod ?? "-") : (node.data.stageDisplay ?? "-");
  const hiddenStems = node.data.hiddenStems ?? [];
  const elementColor = ELEMENT_COLORS_TH[node.data.element] ?? "inherit";

  return (
    <div className="chamber-inspector__pillar">
      <p className="chamber-inspector__kicker">{node.data.pillarLabel}{node.data.isFocal ? " · ดิถี" : ""}</p>
      <div className="chamber-inspector__glyphs">
        <span style={{ color: elementColor }}>{symbol}</span>
      </div>
      <p className="chamber-inspector__translation">{semanticRole} · {translation}</p>
      <dl className="chamber-inspector__details">
        <div className="chamber-inspector__detail-row">
          <dt>ชั้นความหมาย</dt>
          <dd>{semanticRole}</dd>
        </div>
        <div className="chamber-inspector__detail-row">
          <dt>{detailLabel}</dt>
          <dd>{detailValue}</dd>
        </div>
        <div className="chamber-inspector__detail-row">
          <dt>ราศีแฝง</dt>
          <dd>{hiddenStems.length > 0 ? hiddenStems.join(" · ") : "-"}</dd>
        </div>
      </dl>
    </div>
  );
}

function BadgeDetail({ badge }: { badge: BaseChartReactionBadgeValue }) {
  const kicker = `${resolveFamilyLabel(badge)} · ${translatePriority(badge.priority)}`;

  return (
    <div className="chamber-inspector__badge">
      <p className="chamber-inspector__kicker">{kicker}</p>
      <h3 className="chamber-inspector__title">{badge.modal.title}</h3>
      {badge.schoolLabel && <p className="chamber-inspector__school">สาย {badge.schoolLabel}</p>}
      <p className="chamber-inspector__summary">{badge.modal.summary}</p>

      {badge.meaningShort && (
        <p className="chamber-inspector__outcome">
          <strong>ผล:</strong> {badge.meaningShort}
        </p>
      )}

      {badge.modal.details.length > 0 && (
        <details className="chamber-inspector__extra">
          <summary>รายละเอียดเพิ่มเติม</summary>
          <dl className="chamber-inspector__details chamber-inspector__details--doctrine">
            {badge.modal.details.map((detail) => (
              <div key={`${detail.label}-${detail.value}`} className="chamber-inspector__detail-row">
                <dt>{detail.label}</dt>
                <dd>{translateOutcomeDetail(detail.value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      {badge.participants.length > 0 && (
        <div className="chamber-inspector__participants">
          <p className="chamber-inspector__section-title">ตัวประกอบ</p>
          <ul>
            {badge.participants.map((participant, index) => (
              <li key={`${participant.symbol}-${index}`}>
                {participant.pillarKey && PILLAR_LABEL_MAP[participant.pillarKey]
                  ? `${PILLAR_LABEL_MAP[participant.pillarKey]}`
                  : participant.pillarLabel
                    ? `${participant.pillarLabel}`
                    : ""}
                {participant.pillarKey && PILLAR_CONTEXT_SHORT[participant.pillarKey]
                  ? ` (${PILLAR_CONTEXT_SHORT[participant.pillarKey]})`
                  : ""}
                {" · "}
                {participant.symbol}
                {participant.translation ? ` (${participant.translation})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

function EdgeDetail({ edge }: { edge: SemanticEdge }) {
  const badge = edge.data.badge;
  const cluster = edge.data.schoolCluster;

  const kicker = `${resolveFamilyLabel(badge)} · ${translatePriority(badge.priority)}`;

  const title = cluster?.title ?? badge.modal.title;

  const flowCycleLabel = edge.data.flowCycleType
    ? FLOW_CYCLE_MAP[edge.data.flowCycleType] ?? null
    : null;
  const flowDirLabel = edge.data.flowDirection
    ? FLOW_DIRECTION_MAP[edge.data.flowDirection] ?? null
    : null;

  return (
    <div className="chamber-inspector__badge">
      <p className="chamber-inspector__kicker">{kicker}</p>
      <h3 className="chamber-inspector__title">{title}</h3>

      {cluster?.humanSummary && (
        <p className="chamber-inspector__summary">{cluster.humanSummary}</p>
      )}

      {badge.meaningShort && (
        <p className="chamber-inspector__outcome">
          <strong>ผล:</strong> {badge.meaningShort}
        </p>
      )}

      {(flowCycleLabel || flowDirLabel) && (
        <div className="chamber-inspector__flow-tags">
          {flowCycleLabel && (
            <span className="chamber-inspector__flow-tag chamber-inspector__flow-tag--cycle">
              {flowCycleLabel}
            </span>
          )}
          {flowDirLabel && (
            <span className="chamber-inspector__flow-tag chamber-inspector__flow-tag--dir">
              {flowDirLabel}
            </span>
          )}
        </div>
      )}

      <dl className="chamber-inspector__details">
        {edge.data.sourceDetail && (
          <div className="chamber-inspector__detail-row">
            <dt>ผู้กระทำ</dt>
            <dd>{edge.data.sourceDetail}</dd>
          </div>
        )}
        {edge.data.targetDetail && (
          <div className="chamber-inspector__detail-row">
            <dt>ถูกกระทำ</dt>
            <dd>{edge.data.targetDetail}</dd>
          </div>
        )}
        {cluster?.branchParticipantLabels.map((label) => (
          <div key={label} className="chamber-inspector__detail-row">
            <dt>ราศีล่าง</dt>
            <dd>{label}</dd>
          </div>
        ))}
        {cluster?.accentMarkerLabels.map((label) => (
          <div key={label} className="chamber-inspector__detail-row">
            <dt>ดาวประกอบ</dt>
            <dd>{label}</dd>
          </div>
        ))}
        {badge.sourceOutcomeStatus && (
          <div className="chamber-inspector__detail-row">
            <dt>สถานะผลลัพธ์</dt>
            <dd>{translateOutcomeStatus(badge.sourceOutcomeStatus)}</dd>
          </div>
        )}
      </dl>

      {badge.modal.details.length > 0 && (
        <details className="chamber-inspector__extra">
          <summary>รายละเอียดเพิ่มเติม</summary>
          <dl className="chamber-inspector__details chamber-inspector__details--doctrine">
            {badge.modal.details.map((detail) => (
              <div key={`${detail.label}-${detail.value}`} className="chamber-inspector__detail-row">
                <dt>{detail.label}</dt>
                <dd>{translateOutcomeDetail(detail.value)}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}

    </div>
  );
}

function RelationBundleDetail({ bundle }: { bundle: ChamberRelationBundle }) {
  return (
    <div className="chamber-inspector__badge">
      <p className="chamber-inspector__kicker">
        {bundle.mode === "pair" ? "โหมดเทียบสัมพันธ์" : bundle.mode === "multi" ? "โหมดกลุ่มสัมพันธ์" : "โหมด neighborhood"}
      </p>
      {bundle.pairDoctrine && (
        <p className="chamber-inspector__summary">
          {bundle.pairDoctrine.doctrine === "day-master-compare"
            ? "bundle นี้ยึดดิถีเป็นแกน compare และ reveal เฉพาะ relation ที่เชื่อมกับ anchor ที่เลือก"
            : bundle.pairDoctrine.doctrine === "day-pillar-compare"
              ? "bundle นี้ยึดเสาดิถีเป็นแกน compare และ reveal เฉพาะ relation ที่เกี่ยวข้อง"
              : "bundle นี้เปรียบเทียบ anchor สองจุดโดยไม่ยึดดิถีเป็นแกนหลัก"}
        </p>
      )}

      {bundle.relations.length > 0 ? (
        <>
          <p className="chamber-inspector__section-title">ปฏิกิริยาที่พบ</p>
          <dl className="chamber-inspector__details">
            {bundle.relations.map((relation) => (
              <div key={relation.edgeId} className="chamber-inspector__detail-row">
                <dt>{relation.displayLabel}</dt>
                <dd>{translateRelationType(relation.relationType)} · {translateBundleDirection(relation.direction)}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="chamber-inspector__empty">selection นี้ยังไม่มี relation bundle ที่เชื่อมกันโดยตรงใน graph ชุดนี้</p>
      )}

      {bundle.hiddenStemCues.length > 0 && (
        <div className="chamber-inspector__participants">
          <p className="chamber-inspector__section-title">ราศีแฝง</p>
          <ul>
            {bundle.hiddenStemCues.map((cue) => (
              <li key={cue.pillarKey}>{cue.pillarLabel} · {cue.hiddenStems.join(" · ") || "-"}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InspectorBody({
  selection,
  relationBundle,
  readingPacket,
}: {
  selection: ChamberSelection;
  relationBundle: ChamberRelationBundle | null;
  readingPacket: RelationReadingPacket | null;
}) {
  const packetStep = findPacketStepForSelection(selection, readingPacket);

  if (selection.mode === "base" || !selection.primary) {
    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">แผนภาพพื้นดวง</p>
        <p>ดิถีเป็นจุดกลางของการอ่าน ชี้ดูเสาใดก็ได้เพื่อเห็นปฏิกิริยา เส้นที่เกี่ยวข้อง และคำอธิบายตามลำดับสำนัก</p>
      </div>
    );
  }

  if ((selection.mode === "pair" || selection.mode === "multi") && relationBundle) {
    return (
      <>
        <RelationBundleDetail bundle={relationBundle} />
        {packetStep && readingPacket && <PacketReadingCard step={packetStep} packet={readingPacket} />}
      </>
    );
  }

  if (selection.mode === "multi") {
    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">โหมดกลุ่มสัมพันธ์</p>
        <p>เลือกหลาย anchor แล้ว ระบบล็อกไว้เป็น cluster-bundle grammar สำหรับ phase ถัดไปค่ะ</p>
      </div>
    );
  }

  if (selection.primary.kind === "edge") {
    return (
      <>
        <EdgeDetail edge={selection.primary.edge} />
        {packetStep && readingPacket && <PacketReadingCard step={packetStep} packet={readingPacket} />}
      </>
    );
  }

  const badge = getBadgeFromSelection(selection);
  if (badge) {
    return (
      <>
        <BadgeDetail badge={badge} />
        {packetStep && readingPacket && <PacketReadingCard step={packetStep} packet={readingPacket} />}
      </>
    );
  }

  if (selection.primary.kind === "node" && selection.primary.node.data.kind === "pillar") {
    return (
      <>
        <PillarSummary node={selection.primary.node} />
        {packetStep && readingPacket && <PacketReadingCard step={packetStep} packet={readingPacket} />}
      </>
    );
  }

  if (selection.primary.kind === "node" && (selection.primary.node.data.kind === "stem-node" || selection.primary.node.data.kind === "branch-node")) {
    return (
      <>
        <SemanticNodeSummary node={selection.primary.node} />
        {packetStep && readingPacket && <PacketReadingCard step={packetStep} packet={readingPacket} />}
      </>
    );
  }

  return null;
}

export function ChamberInspector({ selection, relationBundle, readingPacket, variant, onClose }: ChamberInspectorProps) {
  if (variant === "docked") {
    return (
      <aside className="chamber-inspector chamber-inspector--docked" aria-label="chamber inspector">
        <div className="chamber-inspector__head">
          <p className="chamber-inspector__head-kicker">รายละเอียดที่เลือก</p>
          <button
            type="button"
            className="chamber-inspector__close"
            onClick={onClose}
            aria-label="ล้าง selection และปิดรายละเอียด"
          >
            ปิด
          </button>
        </div>
        <div className="chamber-inspector__scroll">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${selection.mode}:${selection.primary?.kind ?? "base"}:${selection.primary?.kind === "node" ? selection.primary.node.id : selection.primary?.kind === "edge" ? selection.primary.edge.id : "none"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <InspectorBody selection={selection} relationBundle={relationBundle} readingPacket={readingPacket} />
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {selection.mode !== "base" && (
        <motion.aside
          className="chamber-inspector chamber-inspector--sheet"
          aria-label="chamber inspector"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 220 }}
        >
          <div className="chamber-inspector__sheet-grip" aria-hidden />
          <div className="chamber-inspector__head">
            <p className="chamber-inspector__head-kicker">รายละเอียดที่เลือก</p>
            <button
              type="button"
              className="chamber-inspector__close"
              onClick={onClose}
              aria-label="ปิดรายละเอียด"
            >
              ปิด
            </button>
          </div>
          <div className="chamber-inspector__scroll">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selection.mode}:${selection.primary?.kind ?? "base"}:${selection.primary?.kind === "node" ? selection.primary.node.id : selection.primary?.kind === "edge" ? selection.primary.edge.id : "none"}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <InspectorBody selection={selection} relationBundle={relationBundle} readingPacket={readingPacket} />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
