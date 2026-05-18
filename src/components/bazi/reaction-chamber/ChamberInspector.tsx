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

function buildPairSummary(bundle: ChamberRelationBundle): string {
  if (bundle.pairDoctrine?.doctrine === "day-master-compare") {
    return "ยึดดิถีเป็นแกน แล้วดูว่าสองจุดนี้ส่งแรงเข้า ออก หรือขัดกันอย่างไร";
  }
  if (bundle.pairDoctrine?.doctrine === "day-pillar-compare") {
    return "ยึดเสาดิถีเป็นแกน แล้วเทียบสองจุดว่ากำลังหนุน ขัด หรือโยงแรงเข้าหากันแบบไหน";
  }

  return "เทียบสองจุดโดยตรงเพื่อดูว่ามีแรงสัมพันธ์กันแบบไหนในผังนี้";
}

function buildMultiSummary(bundle: ChamberRelationBundle): string {
  const relationLabels = Array.from(new Set(bundle.relations.map((relation) => relation.displayLabel)));

  if (relationLabels.length === 0) {
    return "กลุ่มที่เลือกยังไม่สร้างเส้นสัมพันธ์ตรงกันในชั้นที่มองเห็นตอนนี้";
  }

  return `กลุ่มนี้กำลังก่อ pattern จาก ${relationLabels.join(" · ")}`;
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
  const primaryMeaning = node.data.kind === "stem-node"
    ? (node.data.isFocal ? "จุดนี้เป็นแกนรับแรงของผังนี้" : `จุดนี้เปิดบทบาทของ${translation}บนผังนี้`)
    : (node.data.stageDisplay ? `ราศีล่างจุดนี้เดินในจังหวะ ${node.data.stageDisplay}` : "จุดนี้ใช้ยืนยันแรงที่ซ่อนอยู่ในราศีล่าง");
  const readingGuide = node.data.kind === "stem-node"
    ? "ดูเส้นที่เชื่อมกับจุดนี้ก่อน แล้วค่อยขยายความผ่าน panel"
    : "ดูเส้นที่พาดผ่านราศีล่างนี้ก่อน แล้วค่อยอ่านราศีแฝงที่รองรับมัน";
  const hiddenStems = node.data.hiddenStems ?? [];
  const elementColor = ELEMENT_COLORS_TH[node.data.element] ?? "inherit";
  const supportingRows = node.data.kind === "stem-node"
    ? [
        { label: "10 เทพ", value: node.data.tenGod ? `เก็บไว้ชั้นรอง (${node.data.tenGod})` : "ใช้เส้นความสัมพันธ์เป็นตัวอ่านหลัก" },
        { label: "ราศีแฝง", value: hiddenStems.length > 0 ? hiddenStems.join(" · ") : "-" },
      ]
    : [
        { label: "12 เชี่ยงแซ", value: node.data.stageDisplay ?? "-" },
        { label: "ราศีแฝง", value: hiddenStems.length > 0 ? hiddenStems.join(" · ") : "-" },
      ];

  return (
    <div className="chamber-inspector__pillar">
      <p className="chamber-inspector__kicker">{node.data.pillarLabel}{node.data.isFocal ? " · ดิถี" : ""}</p>
      <div className="chamber-inspector__glyphs">
        <span style={{ color: elementColor }}>{symbol}</span>
      </div>
      <p className="chamber-inspector__translation">{semanticRole} · {translation}</p>
      <div className="chamber-inspector__primary-block">
        <p className="chamber-inspector__section-title">ความหมายหลัก</p>
        <p className="chamber-inspector__summary">{primaryMeaning}</p>
      </div>
      <div className="chamber-inspector__packet-block">
        <p className="chamber-inspector__section-title">วิธีอ่าน</p>
        <p className="chamber-inspector__explanation">{readingGuide}</p>
      </div>
      <div className="chamber-inspector__packet-block">
        <p className="chamber-inspector__section-title">รายละเอียดรอง</p>
        <dl className="chamber-inspector__details">
          {supportingRows.map((row) => (
            <div key={row.label} className="chamber-inspector__detail-row">
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </div>
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

  const kicker = edge.data.layer === "element-flow"
    ? "คำอ่านความสัมพันธ์"
    : `${resolveFamilyLabel(badge)} · ${translatePriority(badge.priority)}`;

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

      {!cluster?.humanSummary && edge.data.layer === "element-flow" && (
        <p className="chamber-inspector__summary">
          {flowDirLabel
            ? `เส้นนี้อ่านเป็น ${edge.data.flowLabel} โดยดูทิศแรง ${flowDirLabel.toLowerCase()}`
            : "เส้นนี้ใช้บอกบทบาทของแรงธาตุที่กำลังเชื่อมกันอยู่"}
        </p>
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
  const summary = bundle.mode === "pair"
    ? buildPairSummary(bundle)
    : buildMultiSummary(bundle);

  return (
    <div className="chamber-inspector__badge">
      <p className="chamber-inspector__kicker">
        {bundle.mode === "pair" ? "เทียบสองจุด" : bundle.mode === "multi" ? "มองหลายจุด" : "มองบริเวณเดียวกัน"}
      </p>
      <p className="chamber-inspector__summary">{summary}</p>

      {bundle.relations.length > 0 ? (
        <>
          <p className="chamber-inspector__section-title">ปฏิกิริยาที่พบ</p>
          <dl className="chamber-inspector__details">
            {bundle.relations.map((relation) => (
              <div key={relation.edgeId} className="chamber-inspector__detail-row">
                <dt>{relation.displayLabel}</dt>
                <dd>
                  {relation.detailLabel ?? `${translateRelationType(relation.relationType)} · ${translateBundleDirection(relation.direction)}`}
                </dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p className="chamber-inspector__empty">จุดที่เลือกยังไม่เกิดชุดปฏิกิริยาที่เชื่อมกันโดยตรงในผังนี้</p>
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

function HolisticReadingOverview({ packet }: { packet: RelationReadingPacket | null }) {
  if (!packet) {
    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">ผังปฏิกิริยาพื้นดวง</p>
        <p>ชี้ดูเสาใดก็ได้เพื่อเห็นปฏิกิริยาที่เกี่ยวข้อง แล้วค่อยขุดคำอ่านต่อจากจุดนั้นค่ะ</p>
      </div>
    );
  }

  const relationLeads = packet.relationSummary.filter((entry) => entry.targetCount > 0).slice(0, 3);

  return (
    <section className="chamber-inspector__packet-card">
      <p className="chamber-inspector__kicker">คำอ่านภาพรวม</p>
      <h3 className="chamber-inspector__title">{packet.chartAnchor.balanceNarrativeThai}</h3>
      <p className="chamber-inspector__summary">{packet.chartAnchor.identityNarrativeThai}</p>

      {relationLeads.length > 0 && (
        <div className="chamber-inspector__participants">
          <p className="chamber-inspector__section-title">แรงหลักที่กำลังเดินในดวง</p>
          <ul>
            {relationLeads.map((entry) => (
              <li key={entry.relationKey}>{entry.relationLabelThai} · {entry.carrierSummaryThai}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="chamber-inspector__packet-block">
        <p className="chamber-inspector__section-title">ลำดับที่ควรไล่อ่าน</p>
        <p className="chamber-inspector__explanation">
          เริ่มจากดิถีกับเสาวัน แล้วค่อยไล่บทบาทของราศีบน ราศีล่าง และดาวประกอบตามจุดที่สะดุดตาในผังนี้
        </p>
      </div>
    </section>
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
  if (selection.mode === "base" || !selection.primary) {
    return <HolisticReadingOverview packet={readingPacket} />;
  }

  if (selection.mode === "pair" && relationBundle) {
    return (
      <>
        <RelationBundleDetail bundle={relationBundle} />
      </>
    );
  }

  if (selection.mode === "multi") {
    if (relationBundle) {
      return <RelationBundleDetail bundle={relationBundle} />;
    }

    return (
      <div className="chamber-inspector__placeholder">
        <p className="chamber-inspector__kicker">มองหลายจุดพร้อมกัน</p>
        <p>เลือกหลายจุดเพื่อดู pattern ของกลุ่ม ไม่ใช่คำอธิบายทั้งดวงซ้ำอีกครั้งค่ะ</p>
      </div>
    );
  }

  if (selection.primary.kind === "edge") {
    return (
      <>
        <EdgeDetail edge={selection.primary.edge} />
      </>
    );
  }

  const badge = getBadgeFromSelection(selection);
  if (badge) {
    return (
      <>
        <BadgeDetail badge={badge} />
      </>
    );
  }

  if (selection.primary.kind === "node" && selection.primary.node.data.kind === "pillar") {
    return (
      <>
        <PillarSummary node={selection.primary.node} />
      </>
    );
  }

  if (selection.primary.kind === "node" && (selection.primary.node.data.kind === "stem-node" || selection.primary.node.data.kind === "branch-node")) {
    return (
      <>
        <SemanticNodeSummary node={selection.primary.node} />
      </>
    );
  }

  return null;
}

export function ChamberInspector({ selection, relationBundle, readingPacket, variant, onClose }: ChamberInspectorProps) {
  if (variant === "docked") {
    return (
      <aside className="chamber-inspector chamber-inspector--docked" aria-label="คำอ่านประกอบผังปฏิกิริยา">
        <div className="chamber-inspector__head">
          <p className="chamber-inspector__head-kicker">คำอ่านประกอบ</p>
          <button
            type="button"
            className="chamber-inspector__close"
            onClick={onClose}
            aria-label="กลับสู่คำอ่านภาพรวม"
          >
            ภาพรวม
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
          aria-label="คำอ่านประกอบผังปฏิกิริยา"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 26, stiffness: 220 }}
        >
          <div className="chamber-inspector__sheet-grip" aria-hidden />
          <div className="chamber-inspector__head">
            <p className="chamber-inspector__head-kicker">คำอ่านประกอบ</p>
            <button
              type="button"
              className="chamber-inspector__close"
              onClick={onClose}
              aria-label="กลับสู่คำอ่านภาพรวม"
            >
              ภาพรวม
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
