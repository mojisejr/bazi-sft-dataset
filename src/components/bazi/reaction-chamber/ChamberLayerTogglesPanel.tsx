"use client";

import type { ChamberLayerToggles } from "@/lib/bazi/chamber-presentation-store";

type ChamberLayerTogglesPanelProps = {
  layerToggles: ChamberLayerToggles;
  onToggleLayer: (layer: keyof ChamberLayerToggles) => void;
};

const LAYER_OPTIONS: Array<{
  key: keyof ChamberLayerToggles;
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
    label: "กระแสธาตุ",
    description: "เส้นส่งเสริมและพิฆาตในผัง",
  },
  {
    key: "showOverlay",
    label: "เชินซา",
    description: "ดาวประกบที่ช่วยอ่านจังหวะเสริม",
  },
];

export function ChamberLayerTogglesPanel({
  layerToggles,
  onToggleLayer,
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
      </div>
    </section>
  );
}
