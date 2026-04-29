import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

import { classNames } from "@/components/bazi/primitives/classNames";

type ActionTone = "primary" | "secondary";

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ActionTone;
  warning?: boolean;
  children: ReactNode;
};

type ActionLinkProps = {
  href: string;
  tone?: ActionTone;
  warning?: boolean;
  className?: string;
  children: ReactNode;
};

function getActionClassName(tone: ActionTone, warning?: boolean, className?: string) {
  return classNames(
    tone === "primary" ? "primary-action" : "secondary-action",
    warning && tone === "secondary" && "secondary-action--warning",
    className,
  );
}

export function ActionButton({ tone = "secondary", warning = false, className, children, ...props }: ActionButtonProps) {
  return (
    <button className={getActionClassName(tone, warning, className)} {...props}>
      {children}
    </button>
  );
}

export function ActionLink({ href, tone = "secondary", warning = false, className, children }: ActionLinkProps) {
  return (
    <Link className={getActionClassName(tone, warning, className)} href={href}>
      {children}
    </Link>
  );
}