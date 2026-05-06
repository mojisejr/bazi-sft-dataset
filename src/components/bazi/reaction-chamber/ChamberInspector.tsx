"use client";

import { motion, AnimatePresence } from "motion/react";

import type {
  BaseChartReactionBadgeValue,
} from "@/lib/bazi/schema-types";
import type { SemanticEdge, SemanticNode } from "@/lib/bazi/semantic-chamber-graph";

import type { ChamberSelection } from "@/components/bazi/reaction-chamber/ReactionChamberCanvas";

type ChamberInspectorProps = {
  selection: ChamberSelection;
  variant: "docked" | "sheet";
  onClose: () => void;
};

function getBadgeFromSelection(selection: ChamberSelection): BaseChartReactionBadgeValue | null {
  if (!selection) {
    return null;
  }

  if (selection.kind === "edge") {
    return selection.edge.data.badge;
  }

  if (selection.kind === "node" && selection.node.data.kind === "marker") {
    return selection.node.data.badge;
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

function InspectorBody({ selection }: { selection: ChamberSelection }) {
  if (!selection) {
    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">แผนภาพปฏิกิริยา</p>
        <p>ดิถีเป็นจุดกลางของการอ่าน เสารอบนอกคือพื้นที่ที่ดิถีใช้เทียบราศีบน ราศีล่าง เชี่ยงแซ และปฏิกิริยาที่เกิดขึ้นในดวงนี้</p>
      </div>
    );
  }

  if (selection.kind === "edge") {
    return <EdgeDetail edge={selection.edge} />;
  }

  const badge = getBadgeFromSelection(selection);
  if (badge) {
    return <BadgeDetail badge={badge} />;
  }

  if (selection.kind === "node" && selection.node.data.kind === "pillar") {
    return <PillarSummary node={selection.node} />;
  }

  if (selection.kind === "node" && (selection.node.data.kind === "stem-node" || selection.node.data.kind === "branch-node")) {
    return <SemanticNodeSummary node={selection.node} />;
  }

  return null;
}

export function ChamberInspector({ selection, variant, onClose }: ChamberInspectorProps) {
  if (variant === "docked") {
    return (
      <aside className="chamber-inspector chamber-inspector--docked" aria-label="chamber inspector">
        <div className="chamber-inspector__head">
          <p className="chamber-inspector__head-kicker">รายละเอียดที่เลือก</p>
        </div>
        <div className="chamber-inspector__scroll">
          <InspectorBody selection={selection} />
        </div>
      </aside>
    );
  }

  return (
    <AnimatePresence>
      {selection && (
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
            <InspectorBody selection={selection} />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
