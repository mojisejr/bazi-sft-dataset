"use client";

import { motion, AnimatePresence } from "motion/react";

import type {
  BaseChartReactionBadgeValue,
} from "@/lib/bazi/schema-types";
import type { ChamberRelationBundle } from "@/lib/bazi/chamber-relation-bundle";
import type { SemanticEdge, SemanticNode } from "@/lib/bazi/semantic-chamber-graph";

import type { ChamberSelection } from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";

type ChamberInspectorProps = {
  selection: ChamberSelection;
  relationBundle: ChamberRelationBundle | null;
  variant: "docked" | "sheet";
  onClose: () => void;
};

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

  return (
    <div className="chamber-inspector__pillar">
      <p className="chamber-inspector__kicker">{data.pillarLabel}{data.isFocal ? " · ดิถี" : ""}</p>
      <div className="chamber-inspector__glyphs">
        <span>{data.stem}</span>
        <span>{data.branch}</span>
      </div>
      {(data.stemTranslation || data.branchTranslation) && (
        <p className="chamber-inspector__translation">
          {[data.stemTranslation, data.branchTranslation].filter(Boolean).join(" / ")}
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
    ? (node.data.stemTranslation ?? node.data.element)
    : (node.data.branchTranslation ?? node.data.element);
  const semanticRole = node.data.kind === "stem-node" ? "ราศีบน" : "ราศีล่าง";
  const detailLabel = node.data.kind === "stem-node" ? "จับซิ้ง" : "12 เชี่ยงแซ";
  const detailValue = node.data.kind === "stem-node" ? (node.data.tenGod ?? "-") : (node.data.stageDisplay ?? "-");
  const hiddenStems = node.data.hiddenStems ?? [];

  return (
    <div className="chamber-inspector__pillar">
      <p className="chamber-inspector__kicker">{node.data.pillarLabel}{node.data.isFocal ? " · ดิถี" : ""}</p>
      <div className="chamber-inspector__glyphs">
        <span>{symbol}</span>
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
  return (
    <div className="chamber-inspector__badge">
      <p className="chamber-inspector__kicker">{badge.modal.family} · {badge.priority}</p>
      <h3 className="chamber-inspector__title">{badge.modal.title}</h3>
      {badge.schoolLabel && <p className="chamber-inspector__school">สาย {badge.schoolLabel}</p>}
      <p className="chamber-inspector__summary">{badge.modal.summary}</p>
      <p className="chamber-inspector__explanation">{badge.modal.explanation}</p>

      {badge.modal.readingOrderHint && (
        <p className="chamber-inspector__reading-order">{badge.modal.readingOrderHint}</p>
      )}

      {badge.modal.details.length > 0 && (
        <dl className="chamber-inspector__details">
          {badge.modal.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="chamber-inspector__detail-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {badge.participants.length > 0 && (
        <div className="chamber-inspector__participants">
          <p className="chamber-inspector__section-title">ตัวประกอบ</p>
          <ul>
            {badge.participants.map((participant, index) => (
              <li key={`${participant.symbol}-${index}`}>
                {participant.pillarLabel ? `${participant.pillarLabel} · ` : ""}
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

  return (
    <div className="chamber-inspector__badge">
      <p className="chamber-inspector__kicker">{badge.modal.family} · {badge.priority}</p>
      <h3 className="chamber-inspector__title">{cluster?.title ?? badge.modal.title}</h3>
      {cluster && <p className="chamber-inspector__summary">{cluster.humanSummary}</p>}
      <p className="chamber-inspector__explanation">{badge.modal.explanation}</p>

      <dl className="chamber-inspector__details">
        {edge.data.sourceDetail && (
          <div className="chamber-inspector__detail-row">
            <dt>จาก</dt>
            <dd>{edge.data.sourceDetail}</dd>
          </div>
        )}
        {edge.data.targetDetail && (
          <div className="chamber-inspector__detail-row">
            <dt>ไปเทียบกับ</dt>
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
      </dl>

      {badge.modal.details.length > 0 && (
        <dl className="chamber-inspector__details chamber-inspector__details--doctrine">
          {badge.modal.details.map((detail) => (
            <div key={`${detail.label}-${detail.value}`} className="chamber-inspector__detail-row">
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
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
          <p className="chamber-inspector__section-title">Relation Bundle</p>
          <dl className="chamber-inspector__details">
            {bundle.relations.map((relation) => (
              <div key={relation.edgeId} className="chamber-inspector__detail-row">
                <dt>{relation.displayLabel}</dt>
                <dd>{relation.relationType} · {relation.direction} · {relation.strength}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="chamber-inspector__empty">selection นี้ยังไม่มี relation bundle ที่เชื่อมกันโดยตรงใน graph ชุดนี้</p>
      )}

      {bundle.hiddenStemCues.length > 0 && (
        <div className="chamber-inspector__participants">
          <p className="chamber-inspector__section-title">Hidden Stem Cues</p>
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

function InspectorBody({ selection, relationBundle }: { selection: ChamberSelection; relationBundle: ChamberRelationBundle | null }) {
  if (selection.mode === "base" || !selection.primary) {
    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">แผนภาพปฏิกิริยา</p>
        <p>ดิถีเป็นจุดกลางของการอ่าน เสารอบนอกคือพื้นที่ที่ดิถีใช้เทียบราศีบน ราศีล่าง เชี่ยงแซ และปฏิกิริยาที่เกิดขึ้นในดวงนี้</p>
      </div>
    );
  }

  if ((selection.mode === "pair" || selection.mode === "multi") && relationBundle) {
    return <RelationBundleDetail bundle={relationBundle} />;
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
    return <EdgeDetail edge={selection.primary.edge} />;
  }

  const badge = getBadgeFromSelection(selection);
  if (badge) {
    return <BadgeDetail badge={badge} />;
  }

  if (selection.primary.kind === "node" && selection.primary.node.data.kind === "pillar") {
    return <PillarSummary node={selection.primary.node} />;
  }

  if (selection.primary.kind === "node" && (selection.primary.node.data.kind === "stem-node" || selection.primary.node.data.kind === "branch-node")) {
    return <SemanticNodeSummary node={selection.primary.node} />;
  }

  return null;
}

export function ChamberInspector({ selection, relationBundle, variant, onClose }: ChamberInspectorProps) {
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
          <InspectorBody selection={selection} relationBundle={relationBundle} />
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
            <InspectorBody selection={selection} relationBundle={relationBundle} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
