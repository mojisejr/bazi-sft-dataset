"use client";

import type {
  ChamberLayerToggles,
  ChamberToggleLayerKey,
} from "@/lib/bazi/chamber-presentation-store";
import type { SchoolRevealFlowFamily } from "@/lib/bazi/school-reveal-policy";

type ChamberLayerTogglesPanelProps = {
  layerToggles: ChamberLayerToggles;
  onToggleLayer: (layer: ChamberToggleLayerKey) => void;
  onSetEnergyFamily: (family: SchoolRevealFlowFamily) => void;
  onResetLayerFocus: () => void;
};

const LAYER_OPTIONS: Array<{
  key: ChamberToggleLayerKey;
  label: string;
  description: string;
}> = [
  {
    key: "showStructure",
    label: "โครงดิถี",
    description: "เส้นโครงหลักของดิถีและบทบาท",
  },
  {
    key: "showEnergy",
    label: "กระแสธาตุรวม",
    description: "แสดงทุกสายบทบาทเมื่อยังไม่เจาะ family เดียว",
  },
  {
    key: "showReaction",
    label: "ปฏิกิริยา",
    description: "ชง เฮ้ง ไห่ ผั่ว และภาคี",
  },
  {
    key: "showOverlay",
    label: "เชินซา",
    description: "ดาวประกบที่ช่วยอ่านจังหวะเสริม",
  },
];

const ENERGY_FAMILY_OPTIONS: Array<{ key: SchoolRevealFlowFamily; label: string }> = [
  { key: "output", label: "ถ่ายเท" },
  { key: "wealth", label: "โชคลาภ" },
  { key: "power", label: "พิฆาต" },
  { key: "resource", label: "ส่งเสริม" },
  { key: "companion", label: "คู่ธาตุ" },
];

export function ChamberLayerTogglesPanel({
  layerToggles,
  onToggleLayer,
  onSetEnergyFamily,
  onResetLayerFocus,
}: ChamberLayerTogglesPanelProps) {
  return (
    <section className="chamber-layer-panel" aria-label="ชั้นข้อมูลของผังปฏิกิริยา">
      <div className="chamber-layer-panel__container">
        <div className="chamber-layer-panel__copy">
          <p className="chamber-layer-panel__title">ชั้นที่เปิดอ่าน</p>
          <p className="chamber-layer-panel__hint">ค่อย ๆ เปิดชั้นที่ต้องการ โดยให้คำอ่านยังตามกราฟเป็นหลัก</p>
        </div>
        <div className="chamber-layer-panel__buttons">
          {LAYER_OPTIONS.map((option) => {
            const isActive = layerToggles[option.key];
            const layerName = option.key.replace("show", "").toLowerCase();

            return (
              <button
                key={option.key}
                type="button"
                className={`chamber-layer-panel__button${isActive ? " chamber-layer-panel__button--active" : ""}`}
                data-layer={layerName}
                aria-pressed={isActive}
                aria-label={`${option.label}: ${isActive ? "เปิดอยู่" : "ปิดอยู่"}`}
                onClick={() => onToggleLayer(option.key)}
              >
                <span className="chamber-layer-panel__label">{option.label}</span>
                <span className="chamber-layer-panel__description">{option.description}</span>
              </button>
            );
          })}
        </div>
        <div className="chamber-layer-panel__focus-copy">
          <p className="chamber-layer-panel__title">เจาะดูสายบทบาท</p>
          <button
            type="button"
            className={`chamber-layer-panel__reset${layerToggles.energyFamily === "all" ? " chamber-layer-panel__reset--active" : ""}`}
            onClick={onResetLayerFocus}
          >
            กลับภาพเงียบ
          </button>
        </div>
        <div className="chamber-layer-panel__family-pills">
          {ENERGY_FAMILY_OPTIONS.map((family) => (
            <button
              key={family.key}
              type="button"
              className={`chamber-layer-panel__family-pill${layerToggles.energyFamily === family.key ? " chamber-layer-panel__family-pill--active" : ""}`}
              onClick={() => onSetEnergyFamily(family.key)}
              aria-pressed={layerToggles.energyFamily === family.key}
            >
              {family.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
