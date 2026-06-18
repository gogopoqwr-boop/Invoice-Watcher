import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useLocation, Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import { useListPresets, useGetMyOrders } from '@workspace/api-client-react';
import { useWatchConfig } from '@/hooks/use-watch-config';
import { useFavorites, useRecentlyViewed } from '@/hooks/use-favorites';
import WatchMiniCanvas from '@/components/WatchMiniCanvas';
import { BRACELET_COMBOS } from '@/components/WatchFullscreenViewer';
import ThemeToggle from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';

const MAT_LABELS: Record<string, string> = {
  metal: 'Нержавейка', plastic: 'Пластик', metal_solid: 'Металл',
  metal_segmented: 'Сетка', plastic_solid: 'Резина', leather: 'Кожа',
  cotton_fabric: 'NATO нейлон', resin: 'Смола',
};

const COLLECTION_ORDER = ['РОФЛ', 'ГИПЕРСЕРЬЕЗНОСТЬ', 'ЖИВНОСТЬ'];
const MAX_PER = 6;
type InventoryData = Record<string, { sold: number; max: number }>;

const TRANSITION_DURATION = 0.42;
const SCROLL_COOLDOWN = 700;

function useParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
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
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120,160,255,${p.alpha})`;
        ctx.fill();
        p.x += p.dx; p.y += p.dy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);
  return canvasRef;
}

const BIPOLAR_STAGES = [
  { name: 'lightning', dur: 3200 },
  { name: 'rainbow',   dur: 3500 },
  { name: 'summer',    dur: 3200 },
  { name: 'winter',    dur: 3500 },
  { name: 'heavyrain', dur: 3200 },
  { name: 'morning',   dur: 3500 },
] as const;
type BipolarStage = typeof BIPOLAR_STAGES[number]['name'];

const STAGE_GRADIENTS: Record<BipolarStage, string> = {
  lightning: 'linear-gradient(180deg,#0b0520 0%,#1a0845 40%,#2d0a6e 100%)',
  rainbow:   'linear-gradient(180deg,#fce4ec 0%,#e8f5e9 35%,#e3f2fd 70%,#fff8e1 100%)',
  summer:    'linear-gradient(180deg,#0ea5e9 0%,#38bdf8 45%,#fde68a 100%)',
  winter:    'linear-gradient(180deg,#0f172a 0%,#3b82f6 50%,#60a5fa 100%)',
  heavyrain: 'linear-gradient(180deg,#1e293b 0%,#334155 55%,#475569 100%)',
  morning:   'linear-gradient(180deg,#fde68a 0%,#fca5a5 30%,#c7d2fe 70%,#dbeafe 100%)',
};

function BipolarBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<BipolarStage>('lightning');
  const [stage, setStage] = useState<BipolarStage>('lightning');
  const [prevStage, setPrevStage] = useState<BipolarStage | null>(null);
  const [prevOpacity, setPrevOpacity] = useState(0);
  const prevFadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let idx = 0;
    let tid: ReturnType<typeof setTimeout>;
    const cycle = () => {
      const current = BIPOLAR_STAGES[idx];
      tid = setTimeout(() => {
        // Pin the outgoing gradient on top at full opacity
        const outgoing = BIPOLAR_STAGES[idx].name as BipolarStage;
        setPrevStage(outgoing);
        setPrevOpacity(1);

        // Advance to next stage (renders underneath immediately)
        idx = (idx + 1) % BIPOLAR_STAGES.length;
        const next = BIPOLAR_STAGES[idx].name;
        stageRef.current = next;
        setStage(next);

        // One frame later start fading the outgoing layer out
        if (prevFadeTimer.current) clearTimeout(prevFadeTimer.current);
        prevFadeTimer.current = setTimeout(() => setPrevOpacity(0), 32);

        cycle();
      }, current.dur);
    };
    cycle();
    return () => {
      clearTimeout(tid);
      if (prevFadeTimer.current) clearTimeout(prevFadeTimer.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const onResize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', onResize);

    type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; extra?: number };
    let particles: Particle[] = [];
    let lightningFlash = 0;
    let lightningBolts: Array<Array<[number, number]>> = [];
    let lightningTimer = 0;

    const spawnForStage = (s: BipolarStage) => {
      if (s === 'lightning') {
        particles = Array.from({ length: 50 }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6,
          life: Math.random(), maxLife: 1, size: Math.random() * 2.5 + 0.8, extra: Math.random(),
        }));
      } else if (s === 'rainbow') {
        particles = Array.from({ length: 55 }, () => ({
          x: Math.random() * w, y: h * 0.2 + Math.random() * h * 0.5,
          vx: (Math.random() - 0.5) * 0.35, vy: -Math.random() * 0.22 - 0.08,
          life: Math.random(), maxLife: 1, size: Math.random() * 3.5 + 1.2,
        }));
      } else if (s === 'summer') {
        particles = Array.from({ length: 55 }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: Math.random() * 0.7 + 0.2, vy: -(Math.random() * 0.5 + 0.1),
          life: Math.random(), maxLife: 1, size: Math.random() * 3 + 0.8,
        }));
      } else if (s === 'winter') {
        particles = Array.from({ length: 80 }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.5, vy: Math.random() * 0.8 + 0.3,
          life: Math.random() * Math.PI * 2, maxLife: 1, size: Math.random() * 6 + 2,
        }));
      } else if (s === 'heavyrain') {
        particles = Array.from({ length: 160 }, () => ({
          x: Math.random() * (w + 200) - 100, y: Math.random() * h,
          vx: -3.5, vy: Math.random() * 14 + 12,
          life: Math.random(), maxLife: 1, size: Math.random() * 1.2 + 0.5, extra: Math.random() * 22 + 18,
        }));
      } else if (s === 'morning') {
        particles = Array.from({ length: 60 }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.25, vy: -(Math.random() * 0.6 + 0.2),
          life: Math.random(), maxLife: 1, size: Math.random() * 2.5 + 0.8, extra: Math.random() * 8 + 5,
        }));
      }
    };

    spawnForStage(stageRef.current);

    // Generate a branching lightning bolt
    const genBolt = (): Array<[number, number][]> => {
      const bx = w * 0.1 + Math.random() * w * 0.8;
      const main: Array<[number, number]> = [[bx, -10]];
      let cx2 = bx, cy2 = 0;
      const branches: Array<[number, number][]> = [];
      while (cy2 < h * 0.82) {
        cx2 += (Math.random() - 0.5) * 90;
        cy2 += Math.random() * 55 + 25;
        main.push([cx2, cy2]);
        // random fork branch
        if (Math.random() > 0.65 && cy2 > h * 0.15 && cy2 < h * 0.6) {
          const branchLen = 3 + Math.floor(Math.random() * 3);
          const fork: Array<[number, number]> = [[cx2, cy2]];
          let fx = cx2, fy = cy2;
          for (let i = 0; i < branchLen; i++) {
            fx += (Math.random() - 0.5) * 70;
            fy += Math.random() * 45 + 20;
            fork.push([fx, fy]);
          }
          branches.push(fork);
        }
      }
      return [main, ...branches];
    };

    let prevStage = stageRef.current;
    let raf: number;
    let t = 0;
    const draw = () => {
      const s = stageRef.current;
      if (s !== prevStage) { spawnForStage(s); prevStage = s; lightningBolts = []; lightningTimer = 0; lightningFlash = 0; }
      ctx.clearRect(0, 0, w, h);
      t++;

      if (s === 'lightning') {
        lightningTimer++;
        if (lightningTimer % 32 === 0 && Math.random() > 0.2) {
          const allBolts = genBolt();
          if (Math.random() > 0.5) allBolts.push(...genBolt());
          lightningBolts = allBolts;
          lightningFlash = 18;
        }
        if (lightningFlash > 0) {
          ctx.fillStyle = `rgba(160,120,255,${lightningFlash / 18 * 0.22})`;
          ctx.fillRect(0, 0, w, h);
          lightningBolts.forEach((bolt, bi) => {
            ctx.beginPath();
            ctx.moveTo(bolt[0][0], bolt[0][1]);
            bolt.slice(1).forEach(([bx2, by2]) => ctx.lineTo(bx2, by2));
            const isBranch = bi > 0;
            ctx.strokeStyle = `rgba(255,255,210,${lightningFlash / 18 * (isBranch ? 0.6 : 0.95)})`;
            ctx.lineWidth = lightningFlash > 12 ? (isBranch ? 1.5 : 3.5) : (isBranch ? 0.8 : 1.8);
            ctx.shadowColor = '#a78bfa'; ctx.shadowBlur = 22;
            ctx.stroke();
            ctx.shadowBlur = 0;
          });
          lightningFlash--;
        }
        particles.forEach(p => {
          p.life += 0.012;
          const alpha = 0.1 + Math.abs(Math.sin(p.life * 3)) * 0.25 * p.extra!;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(167,139,250,${alpha})`; ctx.fill();
          p.x += p.vx; p.y += p.vy;
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
          if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        });
      } else if (s === 'rainbow') {
        // Vivid multi-band rainbow arcs
        const arcColors = [
          { c: '#ff4d4d', a: 0.55 }, { c: '#ff8c00', a: 0.52 }, { c: '#ffd700', a: 0.5 },
          { c: '#22c55e', a: 0.5 },  { c: '#3b82f6', a: 0.5 },  { c: '#7c3aed', a: 0.48 },
          { c: '#ec4899', a: 0.42 },
        ];
        arcColors.forEach(({ c, a }, i) => {
          const r = w * 0.30 + i * (w * 0.042);
          ctx.beginPath();
          ctx.arc(w / 2, h * 0.78, r, Math.PI, 2 * Math.PI);
          ctx.strokeStyle = c; ctx.lineWidth = w * 0.028;
          ctx.globalAlpha = a; ctx.stroke(); ctx.globalAlpha = 1;
        });
        // Shimmer sparkles
        particles.forEach(p => {
          p.life += 0.008;
          const alpha = 0.3 + Math.abs(Math.sin(p.life * 4)) * 0.45;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
          p.x += p.vx; p.y += p.vy;
          if (p.y < 0 || p.y > h * 0.82) { p.y = h * 0.2 + Math.random() * h * 0.5; p.x = Math.random() * w; p.life = Math.random(); }
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        });
      } else if (s === 'summer') {
        // Rotating sun with animated rays
        const sr = Math.min(w, h) * 0.13;
        const sx = w * 0.76, sy = h * 0.17;
        const rayRot = t * 0.003;
        const rayCount = 14;
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(rayRot);
        for (let i = 0; i < rayCount; i++) {
          const a = (i / rayCount) * Math.PI * 2;
          const isLong = i % 2 === 0;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * sr * 1.22, Math.sin(a) * sr * 1.22);
          ctx.lineTo(Math.cos(a) * sr * (isLong ? 2.2 : 1.72), Math.sin(a) * sr * (isLong ? 2.2 : 1.72));
          ctx.strokeStyle = `rgba(253,211,77,${isLong ? 0.55 : 0.38})`;
          ctx.lineWidth = isLong ? 5 : 3; ctx.lineCap = 'round'; ctx.stroke();
        }
        ctx.restore();
        // Sun disc
        const sunGrd = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr * 1.1);
        sunGrd.addColorStop(0, 'rgba(255,255,180,0.55)');
        sunGrd.addColorStop(0.5, 'rgba(253,211,77,0.35)');
        sunGrd.addColorStop(1, 'rgba(251,146,60,0.15)');
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = sunGrd; ctx.fill();
        // Heat shimmer / pollen particles
        particles.forEach(p => {
          p.life += 0.009;
          const wobble = Math.sin(p.life * 5 + p.x * 0.02) * 0.5;
          const alpha = 0.15 + Math.abs(Math.sin(p.life * 2)) * 0.35;
          ctx.beginPath(); ctx.arc(p.x + wobble, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253,230,138,${alpha})`; ctx.fill();
          p.x += p.vx; p.y += p.vy;
          if (p.x > w + 20) { p.x = -20; p.y = Math.random() * h; }
          if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; }
        });
      } else if (s === 'winter') {
        particles.forEach(p => {
          p.life += 0.008;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.life);
          const ar = p.size;
          const alpha = 0.55 + Math.sin(p.life * 1.5) * 0.2;
          ctx.globalAlpha = alpha;
          for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const armX = Math.cos(a) * ar * 2.6, armY = Math.sin(a) * ar * 2.6;
            // main arm
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(armX, armY);
            ctx.strokeStyle = '#dbeafe'; ctx.lineWidth = 1.1; ctx.stroke();
            // sub-arms (crystal branches)
            [0.4, 0.7].forEach(frac => {
              const mx = Math.cos(a) * ar * 2.6 * frac, my = Math.sin(a) * ar * 2.6 * frac;
              const perp = a + Math.PI / 2;
              const bl = ar * 0.9;
              ctx.beginPath();
              ctx.moveTo(mx + Math.cos(perp) * bl, my + Math.sin(perp) * bl);
              ctx.lineTo(mx - Math.cos(perp) * bl, my - Math.sin(perp) * bl);
              ctx.lineWidth = 0.7; ctx.stroke();
            });
          }
          // center dot
          ctx.beginPath(); ctx.arc(0, 0, ar * 0.4, 0, Math.PI * 2);
          ctx.fillStyle = '#e0f2fe'; ctx.fill();
          ctx.globalAlpha = 1;
          ctx.restore();
          // drift slightly sideways
          p.vx = Math.sin(t * 0.012 + p.maxLife * 6) * 0.45;
          p.x += p.vx; p.y += p.vy;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * w; }
          if (p.x < -20) p.x = w + 20; if (p.x > w + 20) p.x = -20;
        });
      } else if (s === 'heavyrain') {
        particles.forEach(p => {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 3.5, p.y + (p.extra ?? 18));
          const alpha = 0.3 + (p.size / 1.7) * 0.35;
          ctx.strokeStyle = `rgba(148,185,210,${alpha})`;
          ctx.lineWidth = p.size * 0.6;
          ctx.stroke();
          p.x += p.vx; p.y += p.vy;
          if (p.y > h + 20) { p.y = -20; p.x = Math.random() * (w + 200) - 100; }
          if (p.x < -20) p.x = w + 20;
        });
        // Puddle splashes at bottom
        if (t % 14 === 0) {
          const sx2 = Math.random() * w, sy2 = h - 8;
          ctx.beginPath(); ctx.ellipse(sx2, sy2, Math.random() * 18 + 6, 3, 0, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(148,185,210,0.35)'; ctx.lineWidth = 1; ctx.stroke();
        }
      } else if (s === 'morning') {
        // Light shafts from lower-left horizon
        const beamCount = 6;
        const originX = w * 0.1, originY = h * 0.9;
        for (let i = 0; i < beamCount; i++) {
          const spread = 0.15 + i * 0.12;
          const angle = -Math.PI * spread;
          const len = Math.max(w, h) * 1.6;
          const beamW = len * (0.04 + i * 0.025);
          const alpha = (0.07 - i * 0.008) * (0.85 + Math.sin(t * 0.018 + i) * 0.15);
          const grd = ctx.createLinearGradient(originX, originY, originX + Math.cos(angle) * len, originY + Math.sin(angle) * len);
          grd.addColorStop(0, `rgba(253,186,116,${alpha * 2.5})`);
          grd.addColorStop(0.4, `rgba(253,211,77,${alpha})`);
          grd.addColorStop(1, 'rgba(253,211,77,0)');
          ctx.save();
          ctx.translate(originX, originY);
          ctx.rotate(angle - Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(-beamW / 2, 0);
          ctx.lineTo(beamW / 2, 0);
          ctx.lineTo(beamW * 2.5, -len);
          ctx.lineTo(-beamW * 2.5, -len);
          ctx.closePath();
          ctx.fillStyle = grd; ctx.fill();
          ctx.restore();
        }
        // Floating dust / pollen
        particles.forEach(p => {
          p.life += 0.007;
          const alpha = 0.2 + Math.abs(Math.sin(p.life * 2.5)) * 0.4;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(253,230,138,${alpha})`; ctx.fill();
          p.x += p.vx + Math.sin(t * 0.02 + p.life) * 0.3;
          p.y += p.vy;
          if (p.y < -20) { p.y = h + 20; p.x = Math.random() * w; p.life = Math.random(); }
          if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        });
        particles.forEach((p, i) => {
          if (i % 5 !== 0) return;
          ctx.beginPath();
          ctx.arc(p.x * 0.9 + w * 0.05, p.y * 0.4, p.size * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(254,215,170,0.18)';
          ctx.fill();
        });
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  return (
    <>
      {/* Incoming stage — always at full opacity underneath */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{ background: STAGE_GRADIENTS[stage] }}
      />
      {/* Outgoing stage — crossfades out on top */}
      {prevStage && (
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background: STAGE_GRADIENTS[prevStage],
            opacity: prevOpacity,
            transition: 'opacity 1100ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      )}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.9 }} />
    </>
  );
}

function useTilt() {
  const [tilt, setTilt] = useState<{ rx: number; ry: number } | null>(null);
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rx: y * 10, ry: x * -10 });
  }, []);
  const onLeave = useCallback(() => setTilt(null), []);
  return { tilt, onMove, onLeave };
}

export default function CollectionPage() {
  const params = useParams<{ index: string }>();
  const index = Math.max(0, parseInt(params.index ?? '0', 10));
  const [, setLocation] = useLocation();
  const { data: presets, isLoading } = useListPresets();
  const { sessionId } = useWatchConfig();
  const { data: myOrders } = useGetMyOrders({ sessionId }, { query: { enabled: !!sessionId } } as any);
  const hasOrders = Array.isArray(myOrders) && (myOrders as any[]).length > 0;
  const particlesRef = useParticles();

  const { isFavorite, toggle: toggleFav, count: favCount } = useFavorites();
  const { recent, addViewed } = useRecentlyViewed();
  const [showFavs, setShowFavs] = useState(false);

  const [buyModal, setBuyModal] = useState<any | null>(null);
  const [buyStrapColor, setBuyStrapColor] = useState('');
  const [buyStrapMat, setBuyStrapMat] = useState('leather');
  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState('');
  const [inventory, setInventory] = useState<InventoryData>({});

  // ── Search / filter ──────────────────────────────────────────────────────
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setSearchQuery('');
    setTimeout(() => searchInputRef.current?.focus(), 60);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!searchOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeSearch(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [searchOpen, closeSearch]);

  // direction: 1 = going to next (slide up), -1 = going to prev (slide down)
  const [direction, setDirection] = useState(1);
  const scrollRef = useRef<HTMLDivElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const lastScrollTime = useRef(0);
  const isTransitioning = useRef(false);
  const touchStartY = useRef<number | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/presets/inventory')
      .then(r => r.json())
      .then(data => { if (data?.byCollection) setInventory(data.byCollection); })
      .catch(() => {});
  }, []);

  const allPresets = (presets as any[] | undefined) ?? [];
  const classics = allPresets.filter((p: any) => !p.collectionName);
  const bipolarItems = allPresets.filter((p: any) => p.collectionName === 'bipolar').slice(0, MAX_PER);
  const collections: Array<{ name: string | null; displayName: string; items: any[] }> = [
    ...COLLECTION_ORDER.map(name => ({
      name, displayName: name,
      items: allPresets.filter((p: any) => p.collectionName === name).slice(0, MAX_PER),
    })).filter(g => g.items.length > 0),
    ...(classics.length > 0 ? [{ name: null, displayName: 'КЛАССИКА', items: classics.slice(0, MAX_PER) }] : []),
    ...(bipolarItems.length > 0 ? [{ name: 'bipolar', displayName: 'bipolar', items: bipolarItems }] : []),
  ];

  const safeIndex = Math.min(index, Math.max(0, collections.length - 1));
  const group = collections[safeIndex];
  const hasNext = safeIndex < collections.length - 1;
  const hasPrev = safeIndex > 0;

  const goTo = useCallback((nextIndex: number, dir: number) => {
    const now = Date.now();
    if (isTransitioning.current || now - lastScrollTime.current < SCROLL_COOLDOWN) return;
    lastScrollTime.current = now;
    isTransitioning.current = true;
    setDirection(dir);
    setLocation(`/collections/${nextIndex}`);
    setTimeout(() => { isTransitioning.current = false; }, SCROLL_COOLDOWN);
  }, [setLocation]);

  // Prevent browser pull-to-refresh when at top of inner scroll and swiping down
  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    const preventPullToRefresh = (e: TouchEvent) => {
      const inner = scrollRef.current;
      const atTop = !inner || inner.scrollTop <= 0;
      if (atTop && touchStartY.current !== null) {
        const dy = touchStartY.current - e.touches[0].clientY;
        if (dy < 0) e.preventDefault();
      }
    };
    outer.addEventListener('touchmove', preventPullToRefresh, { passive: false });
    return () => outer.removeEventListener('touchmove', preventPullToRefresh);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null || touchStartX.current === null) return;
    if (buyModal) return;
    const deltaY = touchStartY.current - e.changedTouches[0].clientY;
    const deltaX = Math.abs(touchStartX.current - e.changedTouches[0].clientX);
    touchStartY.current = null;
    touchStartX.current = null;
    // Ignore if mostly horizontal or too short a swipe
    if (Math.abs(deltaY) < 50 || deltaX > Math.abs(deltaY) * 0.8) return;
    const inner = scrollRef.current;
    const atBottom = !inner || inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 8;
    const atTop = !inner || inner.scrollTop <= 8;
    if (deltaY > 0 && hasNext && atBottom) {
      goTo(safeIndex + 1, 1);
    } else if (deltaY < 0 && hasPrev && atTop) {
      goTo(safeIndex - 1, -1);
    }
  }, [buyModal, hasNext, hasPrev, safeIndex, goTo]);

  // Scroll wheel navigation
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (buyModal) return;
      const inner = scrollRef.current;
      if (!inner) return;

      const atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 4;
      const atTop = inner.scrollTop <= 4;

      if (e.deltaY > 0 && hasNext && atBottom) {
        e.preventDefault();
        goTo(safeIndex + 1, 1);
      } else if (e.deltaY < 0 && hasPrev && atTop) {
        e.preventDefault();
        goTo(safeIndex - 1, -1);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [safeIndex, hasNext, hasPrev, buyModal, goTo]);

  // Reset inner scroll to top on collection change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [safeIndex]);

  const handleBuyOpen = (e: React.MouseEvent, preset: any) => {
    e.stopPropagation();
    setBuyModal(preset);
    setBuyStrapColor(preset.braceletColor);
    setBuyStrapMat(preset.braceletMaterial ?? 'leather');
    setBuyError('');
  };

  const handleBuyConfirm = async () => {
    if (!buyModal || buying) return;
    setBuying(true); setBuyError('');
    try {
      const cfgRes = await fetch('/api/configurations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, presetId: buyModal.id,
          watchfaceGeometry: buyModal.watchfaceGeometry, watchfaceMaterial: buyModal.watchfaceMaterial,
          watchfaceColor: buyModal.watchfaceColor, braceletMaterial: buyStrapMat || buyModal.braceletMaterial,
          braceletType: buyModal.braceletType, braceletColor: buyStrapColor,
          handsEnabled: buyModal.handsEnabled, handsColor: buyModal.handsColor ?? '#FFFFFF',
          handsStyle: buyModal.watchfaceText ?? '', serialNumber: null,
        }),
      });
      if (!cfgRes.ok) throw new Error('config');
      const cfg = await cfgRes.json();
      const priceRes = await fetch('/api/prices/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchfaceMaterial: buyModal.watchfaceMaterial,
          braceletMaterial: buyStrapMat || buyModal.braceletMaterial,
          handsEnabled: buyModal.handsEnabled,
        }),
      });
      if (!priceRes.ok) throw new Error('price');
      const price = await priceRes.json();
      const orderRes = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: cfg.id, sessionId, totalStars: buyModal.priceStars }),
      });
      if (!orderRes.ok) throw new Error('order');
      const order = await orderRes.json();
      setLocation(`/payment/${order.id}`);
    } catch {
      setBuyError('Не удалось создать заказ. Попробуйте ещё раз.');
    } finally {
      setBuying(false);
    }
  };

  const PresetCard = ({ preset, idx }: { preset: any; idx: number }) => {
    const { tilt, onMove, onLeave } = useTilt();
    const collectionKey = preset.collectionName ?? 'classics';
    const inv = inventory[collectionKey];
    const soldOut = inv ? inv.sold >= inv.max : false;
    const [expanding, setExpanding] = useState(false);
    const faved = isFavorite(preset.id);

    const handleCardClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const root = e.currentTarget.closest('[data-card-root]') as HTMLElement | null;
      if (!root) return;
      setExpanding(true);
      addViewed(preset.id);
      const rect = root.getBoundingClientRect();
      try {
        sessionStorage.setItem('presetOriginRect', JSON.stringify({
          top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom,
          width: rect.width, height: rect.height, x: rect.x, y: rect.y,
          backPath: window.location.pathname,
        }));
      } catch { /* ignore */ }
      setTimeout(() => { setExpanding(false); setLocation(`/preset/${preset.id}`); }, 160);
    };

    return (
      <div
        data-card-root
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative"
        style={{
          transform: expanding
            ? 'perspective(800px) scale(1.05)'
            : tilt
              ? `perspective(800px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg) scale(1.03)`
              : 'perspective(800px) scale(1)',
          transition: expanding ? 'transform 0.16s ease' : tilt ? 'transform 0.05s ease-out' : 'transform 0.3s ease',
          zIndex: expanding ? 10 : 'auto',
        }}
      >
        <button
          onClick={handleCardClick}
          className="liquid-glass rounded-2xl overflow-hidden text-left group focus:outline-none w-full"
          style={{ animationDelay: `${idx * 0.05}s` }}
        >
          <div
            className="h-44 overflow-hidden relative"
            style={{ background: `linear-gradient(135deg, ${preset.watchfaceColor}22, ${preset.braceletColor}18)` }}
          >
            <WatchMiniCanvas preset={preset} paused={false} forceMount />

            {/* Favorite heart button */}
            <button
              className="absolute top-2 left-2 z-10 w-7 h-7 flex items-center justify-center rounded-full transition-all active:scale-90"
              style={{ background: faved ? 'rgba(239,68,68,0.85)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)' }}
              onClick={e => { e.stopPropagation(); toggleFav(preset.id); }}
              aria-label={faved ? 'Убрать из избранного' : 'В избранное'}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill={faved ? '#fff' : 'none'} stroke={faved ? '#fff' : 'rgba(255,255,255,0.8)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
            </button>

            {/* Price badge */}
            {preset.priceStars != null && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums"
                style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }}>
                от {preset.priceStars} <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" strokeWidth="0.8" strokeLinejoin="round" style={{display:'inline',verticalAlign:'middle'}} aria-hidden="true"><path d="M12 2L14.9 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L9.1 8.26L12 2Z"/></svg>
              </div>
            )}

            <div
              className="absolute bottom-0 left-0 right-0 px-2.5 py-2"
              style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
            >
              <p className="text-white text-[11px] font-black tracking-tight leading-tight line-clamp-1">{preset.name}</p>
            </div>
            {soldOut && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-[10px] font-black uppercase tracking-widest bg-black/60 px-2 py-1 rounded-full">Распродано</span>
              </div>
            )}
          </div>
          <div className="px-2.5 py-1.5 flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest truncate">
              {MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial}
            </span>
            <span className="text-[9px] text-primary/60 font-semibold ml-1 shrink-0">Смотреть →</span>
          </div>
        </button>
      </div>
    );
  };

  // Animation variants: direction 1 = next (slide up), -1 = prev (slide down)
  const variants = {
    enter: (dir: number) => ({
      y: dir > 0 ? '6%' : '-6%',
      opacity: 0,
      filter: 'blur(8px)',
    }),
    center: {
      y: '0%',
      opacity: 1,
      filter: 'blur(0px)',
    },
    exit: (dir: number) => ({
      y: dir > 0 ? '-6%' : '6%',
      opacity: 0,
      filter: 'blur(8px)',
    }),
  };

  const isBipolar = group?.name === 'bipolar';

  return (
    <div ref={outerRef} className="fixed inset-0 overflow-hidden bg-background" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {isBipolar ? (
        <BipolarBg />
      ) : (
        <>
          {/* Particles */}
          <canvas ref={particlesRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.8 }} />
          {/* Ambient orbs */}
          <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full pointer-events-none z-0"
            style={{ background: 'var(--orb-1)', filter: 'blur(100px)', opacity: 0.35 }} />
          <div className="fixed bottom-[-5%] left-[-5%] w-[400px] h-[400px] rounded-full pointer-events-none z-0"
            style={{ background: 'var(--orb-2)', filter: 'blur(90px)', opacity: 0.22 }} />
          <div className="fixed top-[50%] right-[10%] w-[260px] h-[260px] rounded-full pointer-events-none z-0"
            style={{ background: 'var(--orb-3)', filter: 'blur(70px)', opacity: 0.18 }} />
        </>
      )}

      {/* ── Top nav ── */}
      <div className="fixed top-0 left-0 right-0 z-30">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/">
            <span className="text-sm font-black uppercase tracking-[0.18em] text-foreground/80 hover:text-foreground transition-colors cursor-pointer select-none" style={{ letterSpacing: '0.18em' }}>
              Чеблячас
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {/* Favorites filter */}
            <button
              onClick={() => setShowFavs(v => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-foreground/8 transition-colors relative"
              style={{ color: showFavs ? '#ef4444' : undefined }}
              aria-label="Избранное"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={showFavs ? '#ef4444' : 'none'} stroke={showFavs ? '#ef4444' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/50" aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              {favCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center text-white" style={{ background: '#ef4444' }}>
                  {favCount}
                </span>
              )}
            </button>
            {/* Search icon */}
            <button
              onClick={searchOpen ? closeSearch : openSearch}
              className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-foreground/8 transition-colors text-foreground/50 hover:text-foreground"
              aria-label="Поиск коллекций"
            >
              {searchOpen ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              )}
            </button>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] px-2.5 py-1 rounded-full border border-primary/40 text-primary/70 bg-primary/5">
              ПРЕДЗАКАЗ
            </span>
            {hasOrders && (
              <Link href="/orders">
                <button className="liquid-button px-4 py-2 text-xs font-semibold">Мои заказы</button>
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* ── Search panel ── */}
        <div
          className="overflow-hidden transition-all"
          style={{
            maxHeight: searchOpen ? '320px' : '0px',
            opacity: searchOpen ? 1 : 0,
            transition: 'max-height 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease',
          }}
        >
          <div className="mx-4 mb-3 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.72)', backdropFilter: 'blur(16px)', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}
          >
            {/* Input */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-black/6">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground shrink-0"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Название коллекции…"
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-muted-foreground hover:text-foreground transition-colors">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>

            {/* Collection chips */}
            <div className="p-3 flex flex-wrap gap-2">
              {collections
                .filter(c => !searchQuery || c.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((c, i) => {
                  const ci = collections.indexOf(c);
                  const active = ci === safeIndex;
                  return (
                    <button
                      key={c.displayName}
                      onClick={() => {
                        const dir = ci > safeIndex ? 1 : -1;
                        isTransitioning.current = false;
                        lastScrollTime.current = 0;
                        goTo(ci, dir);
                        closeSearch();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                      style={{
                        background: active ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.06)',
                        color: active ? '#fff' : 'rgba(0,0,0,0.7)',
                        border: active ? '1px solid transparent' : '1px solid rgba(0,0,0,0.1)',
                      }}
                    >
                      {c.displayName}
                      <span className="opacity-50 text-[10px]">{c.items.length}</span>
                    </button>
                  );
                })}
              {collections.filter(c => !searchQuery || c.displayName.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                <p className="text-xs text-muted-foreground px-1 py-1">Ничего не найдено</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Favorites overlay ── */}
      <AnimatePresence>
        {showFavs && (
          <motion.div
            key="fav-overlay"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-0 z-40 overflow-y-auto pt-20 pb-28 px-5"
            style={{ background: 'var(--background)' }}
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-6">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <h2 className="text-xl font-black tracking-tight">Избранное</h2>
                <span className="text-sm text-muted-foreground">({favCount})</span>
                <button
                  onClick={() => setShowFavs(false)}
                  className="ml-auto text-muted-foreground hover:text-foreground transition-colors text-sm font-semibold"
                >
                  Закрыть ×
                </button>
              </div>
              {favCount === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground/40 mb-4" aria-hidden="true">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                  <p className="text-muted-foreground text-sm">Нет избранных моделей</p>
                  <p className="text-muted-foreground/60 text-xs mt-1">Нажмите ♥ на карточке, чтобы добавить</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {allPresets.filter((p: any) => isFavorite(p.id)).map((preset: any, idx: number) => (
                    <PresetCard key={preset.id} preset={preset} idx={idx} />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <div className="grid grid-cols-2 gap-3 px-5 w-full max-w-md">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="liquid-glass rounded-2xl h-44 animate-pulse" />
            ))}
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait" custom={direction}>
          {group && (
            <motion.div
              key={safeIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: TRANSITION_DURATION,
                ease: [0.32, 0.72, 0, 1],
              }}
              className="flex flex-col h-full pt-16"
            >
              {/* Centered collection title */}
              <div className="flex-none flex flex-col items-center justify-center px-5 pt-6 pb-4 text-center">
                <p className="text-[9px] uppercase tracking-[0.45em] text-muted-foreground/70 mb-2">
                  Коллекция {safeIndex + 1} / {collections.length}
                </p>
                <h2
                  className="font-black tracking-tight leading-[0.95] text-foreground"
                  style={{ fontSize: 'clamp(2.2rem, 10vw, 4.5rem)' }}
                >
                  {group.displayName}
                </h2>
                <p className="text-[10px] text-muted-foreground/70 uppercase tracking-widest mt-2">
                  {group.items.length} моделей · только предзаказ
                </p>
              </div>

              {/* Recently viewed strip */}
              {(() => {
                const recentPresets = recent
                  .map(id => allPresets.find((p: any) => p.id === id))
                  .filter(Boolean)
                  .filter((p: any) => !group.items.find((gi: any) => gi.id === p.id));
                if (recentPresets.length === 0) return null;
                return (
                  <div className="flex-none px-5 pb-3">
                    <p className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground/60 mb-2">Недавно смотрели</p>
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                      {recentPresets.map((preset: any) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            addViewed(preset.id);
                            try {
                              sessionStorage.setItem('presetOriginRect', '{}');
                            } catch { /* ignore */ }
                            setLocation(`/preset/${preset.id}`);
                          }}
                          className="flex-none flex items-center gap-2 px-3 py-1.5 rounded-xl liquid-glass text-left hover:bg-white/5 transition-colors"
                        >
                          <div
                            className="w-5 h-5 rounded-full border border-border/40 shrink-0"
                            style={{ background: `linear-gradient(135deg, ${preset.watchfaceColor ?? '#888'}, ${preset.braceletColor ?? '#444'})` }}
                          />
                          <span className="text-[11px] font-semibold text-foreground/80 whitespace-nowrap">{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Cards */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-none px-5 pb-28 min-h-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
                  {group.items.map((preset: any, idx: number) => (
                    <PresetCard key={preset.id} preset={preset} idx={idx} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Collection dots + down arrow */}
      {!isLoading && collections.length > 1 && (
        <div className="fixed bottom-6 left-0 right-0 z-30 flex flex-col items-center gap-3">
          {/* Down arrow — only when there's a next collection */}
          {hasNext && (
            <motion.button
              onClick={() => goTo(safeIndex + 1, 1)}
              className="flex flex-col items-center gap-1 text-muted-foreground/70 hover:text-foreground transition-colors"
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              aria-label="Следующая коллекция"
            >
              <span className="text-[9px] uppercase tracking-[0.3em] font-semibold">Листай вниз</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </motion.button>
          )}

          {/* Dots */}
          <div className="flex items-center gap-2">
            {collections.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i, i > safeIndex ? 1 : -1)}
                className="transition-all rounded-full"
                style={{
                  width: i === safeIndex ? 20 : 6,
                  height: 6,
                  background: i === safeIndex ? 'var(--primary)' : 'color-mix(in srgb, var(--foreground) 25%, transparent)',
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Buy modal */}
      {buyModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.88)' }}
          onClick={() => { if (!buying) setBuyModal(null); }}
        >
          <div
            className="liquid-glass rounded-3xl w-full max-w-sm overflow-hidden animate-fade-up"
            onClick={e => e.stopPropagation()}
          >
            <div
              className="h-40 flex items-center justify-center relative"
              style={{ background: `linear-gradient(135deg, ${buyModal.watchfaceColor}33, ${buyStrapColor}22)` }}
            >
              <div className="w-24 h-32 flex items-center justify-center">
                <WatchMiniCanvas preset={{ ...buyModal, braceletColor: buyStrapColor, braceletMaterial: buyStrapMat }} />
              </div>
              <button
                onClick={() => setBuyModal(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white text-sm flex items-center justify-center hover:bg-black/60 transition-colors"
              >✕</button>
            </div>
            <div className="p-5">
              <h3 className="text-lg font-black mb-0.5">{buyModal.name}</h3>
              <p className="text-xs text-muted-foreground mb-1">Выберите ремешок</p>
              <p className="text-[10px] text-primary/60 mb-3 uppercase tracking-widest">· Предзаказ — оплата после подтверждения ·</p>
              <div className="grid grid-cols-4 gap-1.5 mb-4 max-h-36 overflow-y-auto pr-1">
                {BRACELET_COMBOS.map(combo => {
                  const isActive = buyStrapColor === combo.color && buyStrapMat === combo.material;
                  return (
                    <button
                      key={combo.id}
                      onClick={() => { setBuyStrapColor(combo.color); setBuyStrapMat(combo.material); }}
                      className={cn('flex flex-col items-center gap-1 p-1.5 rounded-xl transition-all',
                        isActive ? 'ring-2 ring-primary bg-primary/10' : 'hover:bg-white/5')}
                    >
                      <div className="w-6 h-6 rounded-full border-2"
                        style={{ backgroundColor: combo.color, borderColor: isActive ? 'var(--primary)' : 'rgba(255,255,255,0.2)' }} />
                      <span className="text-[9px] text-muted-foreground leading-tight text-center line-clamp-2">{combo.label}</span>
                    </button>
                  );
                })}
              </div>
              {buyError && <p className="text-xs text-red-500 mb-3 font-semibold">{buyError}</p>}
              <button
                onClick={handleBuyConfirm}
                disabled={buying}
                className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm tracking-widest uppercase shadow-lg hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {buying ? 'Оформляем…' : 'Оформить предзаказ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
