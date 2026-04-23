"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!trace) {
    return null;
  }

  const formattedTrace = formatCalculationTrace(trace);
  const developerTrace = formatDeveloperTraceSnapshot(trace);
  const portalTarget = typeof document === "undefined" ? null : document.body;
  const isDeveloperToggleAvailable = process.env.NODE_ENV !== "production";
  const modal = isOpen ? (
    <div className="explainable-modal-root" role="presentation">
      <div
        className="explainable-modal-backdrop"
        onClick={() => setIsOpen(false)}
      />

      <section
        className="explainable-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="explainable-modal__header">
          <div>
            <p className="section-kicker">คำอธิบายวิธีคำนวณ</p>
            <h3 id={headingId}>{title}</h3>
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
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="explainable-trigger"
        onClick={() => setIsOpen(true)}
      >
        {buttonLabel}
      </button>

      {portalTarget && modal ? createPortal(modal, portalTarget) : null}
    </>
  );
}