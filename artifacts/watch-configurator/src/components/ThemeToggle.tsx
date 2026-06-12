import React, { useState, useRef, useCallback } from "react";
import { useTheme } from "@/hooks/use-theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const reflectionRef = useRef<HTMLSpanElement>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const btn = btnRef.current;
    const ref = reflectionRef.current;
    if (!btn || !ref) return;
    const rect = btn.getBoundingClientRect();
    const lx = ((e.clientX - rect.left) / rect.width) * 100;
    const ly = ((e.clientY - rect.top) / rect.height) * 100;
    ref.style.background = `radial-gradient(circle at ${lx}% ${ly}%, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0.08) 55%, transparent 80%)`;
  }, []);

  const handleClick = () => {
    setPressed(true);
    toggleTheme();
    setTimeout(() => setPressed(false), 400);
  };

  const isDark = theme === "dark";

  return (
    <button
      ref={btnRef}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative w-10 h-10 flex items-center justify-center overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      aria-label="Toggle theme"
      style={{
        borderRadius: "12px",
        background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(0,0,0,0.08)",
        backdropFilter: "blur(20px) saturate(200%)",
        WebkitBackdropFilter: "blur(20px) saturate(200%)",
        boxShadow: hovered
          ? isDark
            ? "0 4px 24px rgba(120,160,255,0.28), inset 0 1px 0 rgba(255,255,255,0.2)"
            : "0 4px 24px rgba(80,120,220,0.2), inset 0 1px 0 rgba(255,255,255,0.95)"
          : isDark
            ? "0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)"
            : "0 2px 12px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.8)",
        transition: "background 0.35s ease, border-color 0.35s ease, box-shadow 0.3s ease, transform 0.15s cubic-bezier(0.34,1.56,0.64,1)",
        transform: pressed ? "scale(0.88)" : hovered ? "scale(1.08)" : "scale(1)",
        cursor: "pointer",
        zIndex: 0,
      }}
    >
      {/* Static top highlight */}
      <span
        className="absolute top-0 left-0 right-0 pointer-events-none"
        style={{
          height: "50%",
          borderRadius: "12px 12px 50% 50%",
          background: "linear-gradient(to bottom, rgba(255,255,255,0.18), transparent)",
          zIndex: 1,
        }}
      />
      {/* Dynamic mouse-tracked glass reflection */}
      <span
        ref={reflectionRef}
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: "12px",
          background: "radial-gradient(circle at 50% 20%, rgba(255,255,255,0.18) 0%, transparent 70%)",
          transition: "opacity 0.2s ease",
          opacity: hovered ? 1 : 0.5,
          zIndex: 2,
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
          zIndex: 3,
        }}
      >
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
