import React from "react";
import { useTheme } from "@/hooks/use-theme";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="liquid-button w-10 h-10 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
      title={theme === "dark" ? "Светлая тема" : "Тёмная тема"}
      aria-label="Toggle theme"
    >
      <span className="text-base select-none" style={{ transition: "transform 0.4s ease", display: "block" }}>
        {theme === "dark" ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
