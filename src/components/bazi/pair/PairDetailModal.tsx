"use client";

import type { ReactNode } from "react";

type PairDetailModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function PairDetailModal({ title, onClose, children }: PairDetailModalProps) {
  return (
    <div
      className="pair-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div className="pair-modal" onClick={(event) => event.stopPropagation()}>
        <div className="pair-modal__header">
          <h2>{title}</h2>
          <button
            type="button"
            className="pair-modal__close"
            aria-label="ปิด"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
