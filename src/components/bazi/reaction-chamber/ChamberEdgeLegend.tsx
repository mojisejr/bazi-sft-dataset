"use client";

import { useState } from "react";

type LegendEntry = {
  schoolLabel: string;
  cssClass: string;
  tier?: string;
  dashArray?: string;
  description: string;
};

const LEGEND_ENTRIES: LegendEntry[] = [
  {
    schoolLabel: "ภาคี",
    cssClass: "school-pakhee",
    description: "ดึงดูด แปรธาตุ",
  },
  {
    schoolLabel: "ชง",
    cssClass: "school-chong",
    dashArray: "6 4",
    description: "ปะทะ กระแทก",
  },
  {
    schoolLabel: "ไห่",
    cssClass: "school-hai",
    description: "ให้ร้าย กล่าวหา",
  },
  {
    schoolLabel: "ผั่ว",
    cssClass: "school-pua",
    description: "ทำให้เสียหาย",
  },
  {
    schoolLabel: "เฮ้ง",
    cssClass: "school-heng",
    description: "ทำร้าย เบียดเบียน",
  },
  {
    schoolLabel: "ซำเฮ้ง",
    cssClass: "school-sam-heng",
    description: "โต้เถียง วุ่นวาย",
  },
  {
    schoolLabel: "ฟ้าภาคี",
    cssClass: "school-faa-pakhee",
    description: "ราศีบน ดึงดูด",
  },
  {
    schoolLabel: "ฟ้าพิฆาต",
    cssClass: "school-faa-phikat",
    dashArray: "6 4",
    description: "ราศีบน ปะทะ",
  },
];

const TIER_ENTRIES: LegendEntry[] = [
  {
    schoolLabel: "แรงหลัก",
    cssClass: "tier-primary",
    description: "แรงสำคัญสูงสุด",
  },
  {
    schoolLabel: "แรงรอง",
    cssClass: "tier-secondary",
    dashArray: "8 4",
    description: "แรงรอง",
  },
  {
    schoolLabel: "แรงเสริม",
    cssClass: "tier-tertiary",
    dashArray: "2 6",
    description: "แรงเสริม",
  },
];

type ElementFlowEntry = {
  label: string;
  cycleType: string;
  dashArray?: string;
  description: string;
  colorVar: string;
};

const ELEMENT_FLOW_ENTRIES: ElementFlowEntry[] = [
  {
    label: "生 ผลิต",
    cycleType: "generating",
    description: "ถ่ายเท · ส่งเสริม",
    colorVar: "var(--chamber-element-wood)",
  },
  {
    label: "克 ควบคุม",
    cycleType: "controlling",
    dashArray: "6 3 2 3",
    description: "โชคลาภ · พิฆาต",
    colorVar: "var(--chamber-element-fire)",
  },
];

export function ChamberEdgeLegend() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="chamber-edge-legend">
      <button
        type="button"
        className="chamber-edge-legend__toggle"
        onClick={() => setCollapsed((prev) => !prev)}
        aria-label={collapsed ? "แสดงสัญลักษณ์" : "ซ่อนสัญลักษณ์"}
      >
        <span className="chamber-edge-legend__toggle-label">
          {collapsed ? "▸ สัญลักษณ์" : "▾ สัญลักษณ์"}
        </span>
      </button>

      {!collapsed && (
        <div className="chamber-edge-legend__body">
          <div className="chamber-edge-legend__section">
            <p className="chamber-edge-legend__section-title">สำนักปฏิกิริยา</p>
            <ul className="chamber-edge-legend__list">
              {LEGEND_ENTRIES.map((entry) => (
                <li key={entry.cssClass} className="chamber-edge-legend__item">
                  <svg className="chamber-edge-legend__sample" viewBox="0 0 32 8" width="32" height="8">
                    <line
                      x1="0" y1="4" x2="32" y2="4"
                      className={`chamber-edge-legend__line chamber-edge-legend__line--${entry.cssClass}`}
                      strokeDasharray={entry.dashArray ?? "none"}
                    />
                  </svg>
                  <span className="chamber-edge-legend__label">{entry.schoolLabel}</span>
                  <span className="chamber-edge-legend__desc">{entry.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="chamber-edge-legend__section">
            <p className="chamber-edge-legend__section-title">ระดับความแรง</p>
            <ul className="chamber-edge-legend__list">
              {TIER_ENTRIES.map((entry) => (
                <li key={entry.cssClass} className="chamber-edge-legend__item">
                  <svg className="chamber-edge-legend__sample" viewBox="0 0 32 8" width="32" height="8">
                    <line
                      x1="0" y1="4" x2="32" y2="4"
                      className={`chamber-edge-legend__line chamber-edge-legend__line--${entry.cssClass}`}
                      strokeDasharray={entry.dashArray ?? "none"}
                    />
                  </svg>
                  <span className="chamber-edge-legend__label">{entry.schoolLabel}</span>
                  <span className="chamber-edge-legend__desc">{entry.description}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="chamber-edge-legend__section">
            <p className="chamber-edge-legend__section-title">ทิศทางธาตุ</p>
            <ul className="chamber-edge-legend__list">
              {ELEMENT_FLOW_ENTRIES.map((entry) => (
                <li key={entry.cycleType} className="chamber-edge-legend__item">
                  <svg className="chamber-edge-legend__sample" viewBox="0 0 32 8" width="32" height="8">
                    <line
                      x1="0" y1="4" x2="32" y2="4"
                      className="chamber-edge-legend__line chamber-edge-legend__line--element-flow"
                      strokeDasharray={entry.dashArray ?? "none"}
                      stroke={entry.colorVar}
                    />
                  </svg>
                  <span className="chamber-edge-legend__label">{entry.label}</span>
                  <span className="chamber-edge-legend__desc">{entry.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
