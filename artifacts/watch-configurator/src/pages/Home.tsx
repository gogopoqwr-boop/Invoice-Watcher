import React from "react";
import { Link } from "wouter";

export default function Home() {
  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col items-center justify-center p-6 overflow-hidden relative">

      {/* Subtle background blobs */}
      <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-blue-100/60 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-indigo-100/50 blur-[80px] pointer-events-none" />

      <div className="z-10 text-center mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mb-4">НА_УТРАХ_4</p>
        <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-3 tracking-tight">Че хоч?</h1>
        <p className="text-muted-foreground text-sm">выбери раздел</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 z-10 w-full max-w-sm sm:max-w-none sm:w-auto">
        <Link href="/collections">
          <button className="liquid-button w-full sm:w-auto px-10 py-4 text-sm font-semibold tracking-widest uppercase">
            Часы
          </button>
        </Link>

        <button
          disabled
          className="liquid-button w-full sm:w-auto px-10 py-4 text-sm font-semibold tracking-widest uppercase opacity-35 cursor-not-allowed"
          title="Coming soon"
        >
          Мерч
        </button>
      </div>

      <p className="z-10 mt-6 text-xs text-muted-foreground/50 tracking-widest uppercase">
        at dawn · version 4
      </p>
    </div>
  );
}
