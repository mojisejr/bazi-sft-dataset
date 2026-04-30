"use client";

import { motion, AnimatePresence } from "motion/react";

import type {
  BaseChartReactionBadgeValue,
} from "@/lib/bazi/schema-types";
import type { ChamberNode } from "@/lib/bazi/base-chart-chamber-graph";

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

function PillarSummary({ node }: { node: ChamberNode }) {
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
      {data.roleBadges.length > 0 ? (
        <div className="chamber-inspector__roles">
          <p className="chamber-inspector__section-title">บทบาทของเสาในดวง</p>
          <ul>
            {data.roleBadges.map((badge) => (
              <li key={badge.id}>
                <span className={`chamber-inspector__role-chip chamber-inspector__role-chip--${badge.status}`}>
                  {badge.shortLabel ?? badge.label}
                </span>
                <span className="chamber-inspector__role-meaning">{badge.meaningShort}</span>
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

function InspectorBody({ selection }: { selection: ChamberSelection }) {
  if (!selection) {
    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">ยังไม่ได้เลือกอะไร</p>
        <p>แตะเสา ดวงดาว หรือเส้นปฏิกิริยา เพื่อดูความหมายตามตำราค่ะ</p>
      </div>
    );
  }

  const badge = getBadgeFromSelection(selection);
  if (badge) {
    return <BadgeDetail badge={badge} />;
  }

  if (selection.kind === "node" && selection.node.data.kind === "pillar") {
    return <PillarSummary node={selection.node} />;
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
