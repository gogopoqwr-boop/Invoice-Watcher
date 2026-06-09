import React, { useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "default" | "outline" | "ghost";
}

export const LiquidButton = React.forwardRef<HTMLButtonElement, LiquidButtonProps>(
  ({ children, className, variant = "default", onMouseMove, ...props }, ref) => {
    const [style, setStyle] = useState({});

    const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setStyle({
        "--x": `${x}px`,
        "--y": `${y}px`,
      });
      if (onMouseMove) onMouseMove(e);
    };

    return (
      <button
        ref={ref}
        className={cn(
          "liquid-button inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2",
          variant === "default" && "bg-white/10 text-white hover:bg-white/20",
          variant === "outline" && "border border-input bg-transparent hover:bg-accent hover:text-accent-foreground",
          className
        )}
        onMouseMove={handleMouseMove}
        style={style}
        {...props}
      >
        {children}
      </button>
    );
  }
);
LiquidButton.displayName = "LiquidButton";
