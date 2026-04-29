import type { ReactNode } from "react";

import { classNames } from "@/components/bazi/primitives/classNames";

type BadgeTone = "ai" | "domain";

type BadgeProps = {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
};

export function Badge({ tone = "domain", className, children }: BadgeProps) {
  return (
    <span className={classNames("pending-badge", `pending-badge--${tone}`, className)}>
      {children}
    </span>
  );
}