import React, { useState } from "react";
import { Package } from "lucide-react";

export default function PresaleBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const shipDate = new Date();
  shipDate.setMonth(shipDate.getMonth() + 2);
  const monthName = shipDate.toLocaleString("ru-RU", { month: "long", year: "numeric" });

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 px-4 py-2.5 text-white text-sm font-medium"
      style={{
        background: "linear-gradient(90deg, #1d4ed8 0%, #4f46e5 50%, #7c3aed 100%)",
        boxShadow: "0 2px 16px rgba(79,70,229,0.35)",
      }}
    >
      <div className="flex items-center gap-2 flex-1 justify-center">
        <Package size={14} className="shrink-0 opacity-90" />
        <span>
          <span className="font-black uppercase tracking-wide">Предзаказ</span>
          <span className="mx-2 opacity-60">·</span>
          Часы отправляются в {monthName} — оформите сейчас по стартовой цене
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Закрыть"
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity ml-2 text-base leading-none"
      >
        ✕
      </button>
    </div>
  );
}
