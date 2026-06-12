import React, { useState } from "react";
import { useTheme } from "@/hooks/use-theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    setPressed(true);
    toggleTheme();
    setTimeout(() => setPressed(false), 400);
  };

  return (
    <button
      onClick={handleClick}
      className="relative w-10 h-10 flex items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      aria-label="Toggle theme"
      style={{
        borderRadius: "12px",
        background: theme === "dark"
          ? "rgba(255,255,255,0.06)"
          : "rgba(0,0,0,0.04)",
        border: theme === "dark"
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(0,0,0,0.08)",
        backdropFilter: "blur(16px) saturate(180%)",
        WebkitBackdropFilter: "blur(16px) saturate(180%)",
        boxShadow: theme === "dark"
          ? "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
        transition: "background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
        transform: pressed ? "scale(0.88)" : "scale(1)",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.08)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = theme === "dark"
          ? "0 4px 20px rgba(120,160,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)"
          : "0 4px 20px rgba(80,120,220,0.18), inset 0 1px 0 rgba(255,255,255,0.9)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = theme === "dark"
          ? "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
          : "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)";
      }}
    >
      {/* Liquid glass specular highlight */}
      <span
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "50%",
          borderRadius: "12px 12px 50% 50%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)",
          transition: "opacity 0.35s ease",
        }}
      />
      <span
        className="relative select-none"
        style={{
          fontSize: "1.05rem",
          display: "block",
          transition: "transform 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
          transform: pressed ? "rotate(180deg) scale(0.7)" : "rotate(0deg) scale(1)",
          opacity: pressed ? 0.4 : 1,
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.2))",
        }}
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
