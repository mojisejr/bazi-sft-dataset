import type { ReactNode } from "react";

import { classNames } from "@/components/bazi/primitives/classNames";

type SectionHeadingProps = {
  kicker?: string;
  title: string;
  note?: string;
  titleLevel?: "h2" | "h3" | "h4";
  compact?: boolean;
  className?: string;
  contentClassName?: string;
  actions?: ReactNode;
};

export function SectionHeading({
  kicker,
  title,
  note,
  titleLevel = "h3",
  compact = false,
  className,
  contentClassName,
  actions,
}: SectionHeadingProps) {
  const TitleTag = titleLevel;

  return (
    <div className={classNames("section-heading", compact && "section-heading--compact", className)}>
      <div className={contentClassName}>
        {kicker ? <p className="section-kicker">{kicker}</p> : null}
        <TitleTag>{title}</TitleTag>
        {note ? <p className="section-note">{note}</p> : null}
      </div>
      {actions}
    </div>
  );
}