import { type ButtonHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost";
type ButtonSize = "default" | "sm" | "icon-xs";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:opacity-90",
  outline:
    "border border-border bg-background text-foreground hover:bg-muted hover:text-foreground",
  secondary:
    "bg-secondary text-secondary-foreground hover:opacity-90",
  ghost: "text-foreground hover:bg-muted hover:text-foreground",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-8 px-3 text-sm",
  sm: "h-7 px-2.5 text-[0.8rem]",
  "icon-xs": "h-6 w-6 rounded-md p-0 text-xs",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, type = "button", variant = "default", size = "default", ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      type={type}
      {...props}
    />
  ),
);

Button.displayName = "Button";
