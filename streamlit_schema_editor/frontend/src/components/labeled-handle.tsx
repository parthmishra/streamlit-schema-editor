import React, { type ComponentProps, type ReactNode } from "react";
import { type HandleProps } from "@xyflow/react";

import { BaseHandle } from "./base-handle";
import { cn } from "../lib/utils";

const flexDirections = {
  top: "flex-col",
  right: "flex-row-reverse justify-end",
  bottom: "flex-col-reverse justify-end",
  left: "flex-row",
};

export function LabeledHandle({
  className,
  labelClassName,
  handleClassName,
  label,
  title,
  position,
  ...props
}: HandleProps &
  ComponentProps<"div"> & {
    title: string;
    label?: ReactNode;
    handleClassName?: string;
    labelClassName?: string;
  }) {
  const { ref, ...handleProps } = props;

  return (
    <div
      title={title}
      className={cn(
        "relative flex items-center",
        flexDirections[position],
        className,
      )}
      ref={ref}
    >
      <BaseHandle
        position={position}
        className={handleClassName}
        {...handleProps}
      />
      <div className={cn("text-foreground px-3", labelClassName)}>
        {label ?? title}
      </div>
    </div>
  );
}
