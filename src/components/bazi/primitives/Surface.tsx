import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { classNames } from "@/components/bazi/primitives/classNames";

type SurfaceProps<T extends ElementType> = {
  as?: T;
  inset?: boolean;
  children: ReactNode;
  className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

export function Surface<T extends ElementType = "div">({
  as,
  inset = false,
  children,
  className,
  ...props
}: SurfaceProps<T>) {
  const Component = (as ?? "div") as ElementType;

  return (
    <Component className={classNames("surface", inset && "inset-card", className)} {...props}>
      {children}
    </Component>
  );
}