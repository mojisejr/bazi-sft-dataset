"use client";

import { useState } from "react";

import type { BaseChartReactionBadgeValue } from "@/lib/bazi/schema-types";

type TenGodCategory = {
  label: string;
  description: string;
  badges: BaseChartReactionBadgeValue[];
};

const TEN_GOD_CATEGORIES: Record<string, { label: string; description: string }> = {
  食神: { label: "ถ่ายเท", description: "แรงถ่ายเท การแสดงออก ผลงาน" },
  伤官: { label: "ถ่ายเท", description: "แรงถ่ายเทต่างพลัง ความคิดคม" },
  偏财: { label: "โชคลาภ", description: "ลาภแบบพลิกเร็ว โอกาส เงินหมุน" },
  正财: { label: "โชคลาภ", description: "ลาภที่เป็นระบบ การเงิน ทรัพย์" },
  七杀: { label: "พิฆาต", description: "แรงกด แรงเสี่ยง อำนาจกดดัน" },
  正官: { label: "พิฆาต", description: "หน้าที่ ระเบียบ กติกา ตำแหน่ง" },
  正印: { label: "ส่งเสริม", description: "แรงหนุนตรง ผู้ใหญ่ ครู อุปถัมภ์" },
  偏印: { label: "ส่งเสริม", description: "แรงหนุนเชิงเฉพาะทาง การคิด การศึกษา" },
  比肩: { label: "คู่ธาตุ", description: "พวกเดียวกัน การช่วยเหลือและการแย่งแรง" },
  劫财: { label: "คู่ธาตุ", description: "คู่ธาตุต่างพลัง แรงแข่ง แรงแชร์" },
};

function groupBadgesByCategory(badges: BaseChartReactionBadgeValue[]): TenGodCategory[] {
  const categoryMap = new Map<string, BaseChartReactionBadgeValue[]>();

  for (const badge of badges) {
    const tenGod = badge.modal.details.find((d) => d.label === "จับซิ้ง")?.value;
    if (!tenGod) continue;

    const category = TEN_GOD_CATEGORIES[tenGod];
    if (!category) continue;

    const existing = categoryMap.get(category.label) ?? [];
    existing.push(badge);
    categoryMap.set(category.label, existing);
  }

  const result: TenGodCategory[] = [];
  const seen = new Set<string>();

  for (const [label, categoryBadges] of categoryMap) {
    if (seen.has(label)) continue;
    seen.add(label);
    const category = Object.values(TEN_GOD_CATEGORIES).find((c) => c.label === label);
    result.push({
      label,
      description: category?.description ?? "",
      badges: categoryBadges,
    });
  }

  return result;
}

type ChamberTenGodPanelProps = {
  roleBadges: BaseChartReactionBadgeValue[];
};

export function ChamberTenGodPanel({ roleBadges }: ChamberTenGodPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const categories = groupBadgesByCategory(roleBadges);

  if (categories.length === 0) {
    return null;
  }

  return (
    <>
      <button
        className="chamber-ten-god-toggle"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? "ซ่อน 10 เทพ" : "แสดง 10 เทพ"}
        title={isOpen ? "ซ่อน 10 เทพ" : "10 เทพ"}
      >
        {isOpen ? "×" : "十"}
      </button>

      {isOpen && (
        <div className="chamber-ten-god-panel">
          <h3 className="chamber-ten-god-panel__title">10 เทพ</h3>
          <div className="chamber-ten-god-panel__categories">
            {categories.map((category) => (
              <div key={category.label} className="chamber-ten-god-category">
                <h4 className="chamber-ten-god-category__label">{category.label}</h4>
                <p className="chamber-ten-god-category__description">{category.description}</p>
                <ul className="chamber-ten-god-category__badges">
                  {category.badges.map((badge) => (
                    <li key={badge.id} className="chamber-ten-god-badge">
                      <span className="chamber-ten-god-badge__label">{badge.shortLabel ?? badge.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
