"use client";

import { useState } from "react";

import type { CalculatedStateValue } from "@/lib/bazi/schema-types";

type CompatibilitySurfaceProps = {
  profiles: CalculatedStateValue["compatibilityMatrixProfiles"];
  title?: string;
  kicker?: string;
};

const EARTHLY_BRANCHES = [
  { symbol: "子", label: "ชวด (ปีชวด)" },
  { symbol: "丑", label: "ฉลู (ปีฉลู)" },
  { symbol: "寅", label: "ขาล (ปีขาล)" },
  { symbol: "卯", label: "เถาะ (ปีเถาะ)" },
  { symbol: "辰", label: "มะโรง (ปีมะโรง)" },
  { symbol: "巳", label: "มะเส็ง (ปีมะเส็ง)" },
  { symbol: "午", label: "มะเมีย (ปีมะเมีย)" },
  { symbol: "未", label: "มะแม (ปีมะแม)" },
  { symbol: "申", label: "วอก (ปีวอก)" },
  { symbol: "酉", label: "ระกา (ปีระกา)" },
  { symbol: "戌", label: "จอ (ปีจอ)" },
  { symbol: "亥", label: "กุน (ปีกุน)" },
];

const DOMAIN_LABELS: Record<string, string> = {
  love: "ความรัก",
  work: "การงาน",
};

export function CompatibilitySurface({
  profiles,
  title = "คู่ครอง · คู่ร่วมงาน",
  kicker = "สมพงษ์",
}: CompatibilitySurfaceProps) {
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  if (profiles.length === 0) {
    return (
      <section className="surface inset-card compatibility-surface" data-compatibility="empty">
        <div className="section-heading section-heading--compact">
          <p className="section-kicker">{kicker}</p>
          <h3>{title}</h3>
        </div>
        <p className="compatibility-surface__empty">
          รอบนี้ engine ยังไม่ส่งข้อมูลสมพงษ์เข้ามา
        </p>
      </section>
    );
  }

  const matchedEntries = selectedBranch
    ? (() => {
        const grouped = new Map<string, { domainLabel: string; entry: (typeof profiles)[number]["entries"][number] | null }>();
        for (const profile of profiles) {
          if (!grouped.has(profile.domain)) {
            const entry = profile.entries.find((e) => e.counterpartBranch === selectedBranch) ?? null;
            grouped.set(profile.domain, {
              domainLabel: DOMAIN_LABELS[profile.domain] ?? profile.domain,
              entry,
            });
          }
        }
        return Array.from(grouped.entries()).map(([domain, data]) => ({
          domain,
          ...data,
        }));
      })()
    : [];

  const hasResults = matchedEntries.some((m) => m.entry !== null);

  return (
    <section className="surface inset-card compatibility-surface" data-compatibility={selectedBranch ? "matched" : "available"}>
      <div className="section-heading section-heading--compact">
        <p className="section-kicker">{kicker}</p>
        <h3>{title}</h3>
      </div>

      <label className="compatibility-surface__selector">
        <span className="compatibility-surface__selector-label">อีกฝ่ายเกิดปี</span>
        <select
          className="compatibility-surface__select"
          value={selectedBranch ?? ""}
          onChange={(event) => setSelectedBranch(event.target.value || null)}
        >
          <option value="">— เลือกปีนักษัตร —</option>
          {EARTHLY_BRANCHES.map((branch) => (
            <option key={branch.symbol} value={branch.symbol}>
              {branch.label}
            </option>
          ))}
        </select>
      </label>

      {selectedBranch && hasResults ? (
        <div className="compatibility-surface__results">
          {matchedEntries.map(({ domain, domainLabel, entry }) => {
            if (!entry) return null;
            return (
              <article key={domain} className="compatibility-surface__result" data-domain={domain}>
                <p className="compatibility-surface__result-domain">{domainLabel}</p>
                {entry.scoreText ? (
                  <p className="compatibility-surface__result-score">{entry.scoreText}</p>
                ) : null}
                {entry.narrative ? (
                  <p className="compatibility-surface__result-narrative">{entry.narrative}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : selectedBranch ? (
        <p className="compatibility-surface__no-match">
          ไม่พบข้อมูลสมพงษ์สำหรับปี{EARTHLY_BRANCHES.find((b) => b.symbol === selectedBranch)?.label ?? selectedBranch}
        </p>
      ) : (
        <p className="compatibility-surface__hint">
          เลือกปีเกิดอีกฝ่ายเพื่อดูสมพงษ์
        </p>
      )}
    </section>
  );
}
