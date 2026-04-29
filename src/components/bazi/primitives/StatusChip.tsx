import type { ReactNode } from "react";

import { classNames } from "@/components/bazi/primitives/classNames";

type StatusTone = "idle" | "busy" | "ready" | "error";

type StatusChipProps = {
  tone: StatusTone;
  children: ReactNode;
};

export function StatusChip({ tone, children }: StatusChipProps) {
  return (
    <div className={classNames("status-chip", `status-chip--${tone}`)}>
      <span className="status-dot" aria-hidden="true" />
      {children}
    </div>
  );
}