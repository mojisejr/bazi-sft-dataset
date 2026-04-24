"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

type DetailOverlayProps = {
  isOpen: boolean;
  title: string;
  kicker?: string;
  summary?: string;
  footer?: ReactNode;
  closeLabel?: string;
  panelClassName?: string;
  onClose: () => void;
  children: ReactNode;
};

export function DetailOverlay({
  isOpen,
  title,
  kicker = "รายละเอียดเพิ่มเติม",
  summary,
  footer,
  closeLabel = "ปิด",
  panelClassName,
  onClose,
  children,
}: DetailOverlayProps) {
  const headingId = useId();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div className="explainable-modal-root" role="presentation">
      <button
        type="button"
        className="explainable-modal-backdrop"
        aria-label="ปิดรายละเอียด"
        onClick={onClose}
      />
      <section
        className={`explainable-modal${panelClassName ? ` ${panelClassName}` : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
      >
        <div className="explainable-modal__header">
          <div>
            <p className="section-kicker">{kicker}</p>
            <h3 id={headingId}>{title}</h3>
          </div>

          <button
            type="button"
            className="explainable-close"
            aria-label="ปิดคำอธิบาย"
            onClick={onClose}
          >
            {closeLabel}
          </button>
        </div>

        {summary ? <p className="metric-copy explainable-summary">{summary}</p> : null}

        {children}

        {footer ? <div className="explainable-modal__footer">{footer}</div> : null}
      </section>
    </div>,
    document.body,
  );
}