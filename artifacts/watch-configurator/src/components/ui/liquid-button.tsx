import React from "react";
import { cn } from "@/lib/utils";

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "default" | "primary";
}

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ children, className, variant = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "liquid-button inline-flex items-center justify-center whitespace-nowrap text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50 h-10 px-5 py-2",
          variant === "primary" && "bg-primary text-white border-primary hover:bg-primary/90",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
LiquidButton.displayName = "LiquidButton";
