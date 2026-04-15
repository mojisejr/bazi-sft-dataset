"use client";

import { useEffect, useId, useState } from "react";

import type { CalculationTraceValue } from "@/lib/bazi/schema-types";
import { formatCalculationTrace } from "@/lib/bazi/trace-formatter";

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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!trace) {
    return null;
  }

  const formattedTrace = formatCalculationTrace(trace);

  return (
    <>
      <button
        type="button"
        className="explainable-trigger"
        onClick={() => setIsOpen(true)}
      >
        {buttonLabel}
      </button>

      {isOpen ? (
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
                <p className="section-kicker">Explainable Logic</p>
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
          </section>
        </div>
      ) : null}
    </>
  );
}