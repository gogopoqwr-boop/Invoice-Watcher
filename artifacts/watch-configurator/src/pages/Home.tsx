import React, { useEffect, useRef } from "react";
import { Link } from "wouter";
import { useWatchConfig } from "@/hooks/use-watch-config";
import { useGetMyOrders } from "@workspace/api-client-react";

function FloatingWatch() {
  return (
    <div className="animate-float-watch select-none pointer-events-none" style={{ filter: "drop-shadow(0 24px 48px rgba(80,130,255,0.22))" }}>
      <svg viewBox="0 0 120 200" width="220" height="366" xmlns="http://www.w3.org/2000/svg">
        {/* Top strap */}
        <rect x="45" y="0" width="30" height="48" rx="6" fill="currentColor" className="text-slate-700 dark:text-slate-300" opacity="0.85"/>
        <rect x="50" y="20" width="20" height="3" rx="1.5" fill="white" opacity="0.3"/>
        <rect x="58" y="16" width="4" height="11" rx="2" fill="white" opacity="0.25"/>

        {/* Case */}
        <rect x="18" y="46" width="84" height="108" rx="24" fill="url(#caseGrad)" />
        <rect x="22" y="50" width="76" height="96" rx="21" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5"/>

        {/* Crown */}
        <rect x="108" y="92" width="10" height="16" rx="4" fill="currentColor" className="text-slate-600 dark:text-slate-400"/>

        {/* Dial */}
        <rect x="28" y="56" width="64" height="88" rx="18" fill="url(#dialGrad)" />

        {/* Hour markers */}
        {[0,1,2,3,4,5,6,7,8,9,10,11].map(i => {
          const a = (i * 30 - 90) * Math.PI / 180;
          const r = i % 3 === 0 ? 26 : 27;
          const len = i % 3 === 0 ? 5 : 3;
          const cx = 60, cy = 100;
          const x1 = cx + r * Math.cos(a);
          const y1 = cy + r * Math.sin(a);
          const x2 = cx + (r - len) * Math.cos(a);
          const y2 = cy + (r - len) * Math.sin(a);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.6)" strokeWidth={i % 3 === 0 ? 2 : 1} strokeLinecap="round"/>;
        })}

        {/* Brand text */}
        <text x="60" y="86" textAnchor="middle" fontSize="5" fill="rgba(255,255,255,0.5)" fontFamily="monospace" letterSpacing="1">ЧЕБЛЯЧАС</text>

        {/* Hour hand */}
        <line x1="60" y1="100" x2="60" y2="78" stroke="white" strokeWidth="3" strokeLinecap="round" transform="rotate(130,60,100)"/>
        {/* Minute hand */}
        <line x1="60" y1="100" x2="60" y2="72" stroke="white" strokeWidth="2" strokeLinecap="round" transform="rotate(210,60,100)"/>
        {/* Second hand */}
        <line x1="60" y1="100" x2="60" y2="76" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" transform="rotate(300,60,100)"/>
        {/* Center dot */}
        <circle cx="60" cy="100" r="3" fill="white"/>
        <circle cx="60" cy="100" r="1.5" fill="#ef4444"/>

        {/* Crystal glare */}
        <ellipse cx="44" cy="68" rx="14" ry="8" fill="rgba(255,255,255,0.08)" transform="rotate(-20,44,68)"/>

        {/* Bottom strap */}
        <rect x="45" y="152" width="30" height="48" rx="6" fill="currentColor" className="text-slate-700 dark:text-slate-300" opacity="0.85"/>
        <rect x="50" y="165" width="20" height="3" rx="1.5" fill="white" opacity="0.3"/>

        <defs>
          <linearGradient id="caseGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#2d3a5e"/>
            <stop offset="100%" stopColor="#1a2540"/>
          </linearGradient>
          <linearGradient id="dialGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0f1d3a"/>
            <stop offset="100%" stopColor="#0a1225"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { sessionId } = useWatchConfig();
  const { data: orders } = useGetMyOrders(
    { sessionId },
    { query: { enabled: !!sessionId } } as any
  );
  const hasOrders = Array.isArray(orders) && (orders as any[]).length > 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      dx: (Math.random() - 0.5) * 0.25,
      dy: (Math.random() - 0.5) * 0.25,
      alpha: Math.random() * 0.35 + 0.08,
    }));

    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const isDark = document.documentElement.getAttribute("data-theme") === "dark";
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isDark
          ? `rgba(120,160,255,${p.alpha})`
          : `rgba(80,120,220,${p.alpha * 0.6})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, []);

  return (
    <div
      className="w-full bg-background"
      style={{
        height: "100dvh",
        overflowY: "scroll",
        overflowX: "hidden",
        scrollSnapType: "y mandatory",
      }}
    >
      {/* Ambient orbs — fixed so they persist across slides */}
      <div className="fixed top-[15%] left-[20%] w-[520px] h-[520px] rounded-full pointer-events-none animate-float-orb z-0"
        style={{ background: "var(--orb-1)", filter: "blur(90px)", animationDelay: "0s" }} />
      <div className="fixed bottom-[20%] right-[15%] w-[380px] h-[380px] rounded-full pointer-events-none animate-float-orb z-0"
        style={{ background: "var(--orb-2)", filter: "blur(80px)", animationDelay: "2.5s" }} />
      <div className="fixed top-[55%] left-[55%] w-[260px] h-[260px] rounded-full pointer-events-none animate-float-orb z-0"
        style={{ background: "var(--orb-3)", filter: "blur(70px)", animationDelay: "1.2s" }} />

      {/* Particle canvas — fixed to viewport */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 pointer-events-none z-0"
        style={{ opacity: 0.8 }}
      />

      {/* ── SLIDE 1: Title + buttons ── */}
      <section
        className="relative z-10 flex flex-col items-center justify-center select-none px-6"
        style={{ height: "100dvh", scrollSnapAlign: "start" }}
      >
        <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground mb-6 animate-fade-up">
          Чеблячас
        </p>

        <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tight text-foreground leading-[0.9] mb-10 animate-fade-up delay-100">
          Че хоч?
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto animate-fade-up delay-200">
          <Link href="/collections">
            <button className="liquid-button w-full sm:w-auto px-12 py-4 text-sm font-bold tracking-[0.2em] uppercase">
              ⌚ Часы
            </button>
          </Link>
          <button
            disabled
            className="liquid-button w-full sm:w-auto px-12 py-4 text-sm font-bold tracking-[0.2em] uppercase opacity-30 cursor-not-allowed"
            title="Coming soon"
          >
            Мерч
          </button>
        </div>

        {hasOrders && (
          <Link href="/orders" className="z-10 mt-4 animate-fade-up delay-300">
            <button className="liquid-button px-7 py-2.5 text-sm font-semibold tracking-widest">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle',marginRight:6}} aria-hidden="true"><path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" y1="22" x2="12" y2="12"/></svg>Мои заказы
            </button>
          </Link>
        )}

        <div className="mt-4 flex items-center gap-4 animate-fade-up delay-400">
          <p className="text-xs text-muted-foreground/40 tracking-[0.25em] uppercase">
            Чеблячас · версия 4
          </p>
          <span className="text-muted-foreground/20">·</span>
          {import.meta.env.VITE_TELEGRAM_CHANNEL && (
            <a
              href={import.meta.env.VITE_TELEGRAM_CHANNEL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors tracking-widest uppercase flex items-center gap-1"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.17 13.667l-2.95-.924c-.64-.203-.658-.64.136-.954l11.57-4.461c.537-.194 1.006.131.968.893z"/>
              </svg>
              канал
            </a>
          )}
          <span className="text-muted-foreground/20">·</span>
          <Link href="/login">
            <button className="text-xs text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors tracking-widest uppercase">
              панель
            </button>
          </Link>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 animate-fade-up delay-500">
          <div className="w-px h-10 bg-gradient-to-b from-muted-foreground/30 to-transparent mx-auto animate-pulse" />
        </div>
      </section>

      {/* ── SLIDE 2: Floating watch + specs ── */}
      <section
        className="relative z-10 flex flex-col items-center justify-center select-none px-6"
        style={{ height: "100dvh", scrollSnapAlign: "start" }}
      >
        <FloatingWatch />
        <p className="mt-6 text-xs uppercase tracking-[0.45em] text-muted-foreground/50 animate-fade-up">
          Чеблячас
        </p>

        {/* Specs row to fill horizontal space on large screens */}
        <div className="mt-8 flex items-center gap-8 md:gap-14 animate-fade-up">
          {[
            { label: "материал", value: "нерж. сталь" },
            { label: "лимит", value: "1 000 экз." },
            { label: "оплата", value: "Telegram Stars" },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/40 mb-1">{label}</p>
              <p className="text-xs font-bold text-muted-foreground/70 tracking-wide">{value}</p>
            </div>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8">
          <div className="w-px h-10 bg-gradient-to-b from-muted-foreground/30 to-transparent mx-auto animate-pulse" />
        </div>
      </section>

      {/* ── SLIDE 3: Copyright ── */}
      <section
        className="relative z-10 flex items-center justify-center px-6"
        style={{ height: "100dvh", scrollSnapAlign: "start" }}
      >
        <div className="text-center space-y-3 select-none">
          <p
            className="text-muted-foreground/50 text-sm md:text-base tracking-[0.15em] leading-relaxed"
            style={{ fontVariant: "small-caps" }}
          >
            Чеблячас все у права мои у меня пон?
          </p>
          <p
            className="text-muted-foreground/30 text-xs md:text-sm tracking-[0.12em] leading-relaxed"
            style={{ fontVariant: "small-caps" }}
          >
            Чеблячас © 2026. Сборка приостановлена из-за полного дзена.
          </p>
        </div>
      </section>
    </div>
  );
}
