import type { ComponentProps } from "react";
import { Handle } from "@xyflow/react";

import { cn } from "../lib/utils";

export function BaseHandle({
  className,
  children,
  style,
  ...props
}: ComponentProps<typeof Handle>) {
  return (
    <Handle
      {...props}
      className={cn(
        "h-[11px] w-[11px] rounded-full border border-border bg-background transition",
        className,
      )}
      style={{
        border: "1px solid var(--border)",
        backgroundColor: "var(--background)",
        ...style,
      }}
    >
      {children}
    </Handle>
  );
}
