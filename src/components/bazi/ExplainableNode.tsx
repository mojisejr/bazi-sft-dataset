"use client";

import { useId, useState } from "react";

import type { CalculationTraceValue } from "@/lib/bazi/schema-types";
import {
  formatCalculationTrace,
  formatDeveloperTraceSnapshot,
} from "@/lib/bazi/trace-formatter";

type ExplainableNodeProps = {
  title: string;
  buttonLabel: string;
  trace: CalculationTraceValue | undefined;
};

export function ExplainableNode({
  title,
  buttonLabel,
  trace,
}: ExplainableNodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const headingId = useId();

  if (!trace) {
    return null;
  }

  const formattedTrace = formatCalculationTrace(trace);
  const developerTrace = formatDeveloperTraceSnapshot(trace);
  const isDeveloperToggleAvailable = process.env.NODE_ENV !== "production";

  return (
    <div className="explainable-node" data-explainable-open={isOpen ? "true" : "false"}>
      <button
        type="button"
        className="explainable-trigger"
        aria-expanded={isOpen}
        aria-controls={headingId}
        onClick={() => setIsOpen((current) => !current)}
      >
        {isOpen ? "ซ่อนวิธีคำนวณ" : buttonLabel}
      </button>

      {isOpen ? (
        <section
          id={headingId}
          className="explainable-sheet"
          aria-label={title}
          aria-hidden={isOpen ? "false" : "true"}
        >
          <div className="explainable-sheet__header">
            <div>
              <p className="section-kicker">คำอธิบายวิธีคำนวณ</p>
              <h3>{title}</h3>
            </div>

            <button
              type="button"
              className="explainable-close"
              aria-label="ปิดคำอธิบาย"
              onClick={() => setIsOpen(false)}
            >
              ปิด
            </button>
          </div>

          <p className="metric-copy explainable-summary">{formattedTrace.summary}</p>

          <ol className="explainable-step-list">
            {formattedTrace.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>

          {isDeveloperToggleAvailable && developerTrace ? (
            <details className="explainable-devtools">
              <summary>โหมดนักพัฒนา: ดูข้อมูล trace ดิบ</summary>
              <p className="explainable-devtools__note">
                ส่วนนี้ซ่อนจากผู้ใช้งานทั่วไป และมีไว้สำหรับตรวจตัวแปรดิบ, rule name, และ step keys ระหว่างพัฒนาเท่านั้น
              </p>
              <pre className="explainable-devtools__json">{developerTrace}</pre>
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}