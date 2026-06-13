import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { useListPresets } from '@workspace/api-client-react';
import WatchModel from '@/components/WatchModel';
import WatchSVG from '@/components/WatchSVG';
import { WebGLErrorBoundary } from '@/components/WebGLErrorBoundary';
import { useWatchConfig } from '@/hooks/use-watch-config';

function checkWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch { return false; }
}
const WEB_GL_OK = checkWebGL();

const MAT_LABELS: Record<string, string> = {
  metal: 'Нержавейка', plastic: 'Пластик', metal_solid: 'Металл',
  metal_segmented: 'Сетка', plastic_solid: 'Резина', leather: 'Кожа',
  cotton_fabric: 'NATO нейлон', resin: 'Смола',
};

function WatchScene() {
  const lastInteraction = React.useRef<number>(0);
  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 6]} intensity={1.3} castShadow />
      <directionalLight position={[-3, -2, -4]} intensity={0.28} />
      <pointLight position={[-4, 2, 3]} intensity={0.7} color="#6366f1" />
      <hemisphereLight intensity={0.25} />
      <Environment preset="city" />
      <ContactShadows position={[0, -5.9, 0]} opacity={0.55} scale={14} blur={2.0} far={6} />
      <WatchModel step={0} lastInteractionRef={lastInteraction} />
      <OrbitControls
        enablePan={false} enableZoom={true}
        minDistance={4} maxDistance={13} rotateSpeed={0.55}
        onStart={() => { lastInteraction.current = Date.now(); }}
      />
    </>
  );
}

type Phase = 'enter' | 'open' | 'exit';

// Saved rect from the card click
function getOriginRect(): DOMRect | null {
  try {
    const raw = sessionStorage.getItem('presetOriginRect');
    if (!raw) return null;
    const d = JSON.parse(raw);
    return { top: d.top, left: d.left, right: d.right, bottom: d.bottom,
             width: d.width, height: d.height, x: d.x, y: d.y,
             toJSON: () => d } as DOMRect;
  } catch { return null; }
}

function rectToClip(rect: DOMRect): string {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const t = ((rect.top / vh) * 100).toFixed(2);
  const l = ((rect.left / vw) * 100).toFixed(2);
  const r = (((vw - rect.right) / vw) * 100).toFixed(2);
  const b = (((vh - rect.bottom) / vh) * 100).toFixed(2);
  return `inset(${t}% ${r}% ${b}% ${l}% round 24px)`;
}

export default function PresetViewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { data: presets } = useListPresets();
  const { updateConfig, sessionId } = useWatchConfig();

  const [phase, setPhase] = useState<Phase>('enter');
  const originRect = useRef<DOMRect | null>(getOriginRect());

  const preset = useMemo(() =>
    ((presets as any[]) ?? []).find((p: any) => String(p.id) === String(id)),
    [presets, id]
  );

  // Compute clip start from stored card rect
  const clipStart = useMemo(() => {
    if (!originRect.current) return 'inset(0% 0% 0% 0% round 0px)';
    return rectToClip(originRect.current);
  }, []);

  // Expand animation on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('open')));
    return () => cancelAnimationFrame(t);
  }, []);

  // Sync preset into global config when loaded
  useEffect(() => {
    if (!preset) return;
    updateConfig({
      presetId: preset.id,
      watchfaceGeometry: preset.watchfaceGeometry,
      watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor,
      braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType,
      braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled,
      handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '',
      watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
      handsCount: 3,
    });
  }, [preset?.id]);

  const goBack = useCallback(() => {
    // Reverse the clip back into the card, then navigate
    setPhase('exit');
    setTimeout(() => setLocation('/collections'), 520);
  }, [setLocation]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goBack]);

  const handleBuy = useCallback(async () => {
    if (!preset) return;
    try {
      const cfgRes = await fetch('/api/configurations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId, presetId: preset.id,
          watchfaceGeometry: preset.watchfaceGeometry,
          watchfaceMaterial: preset.watchfaceMaterial,
          watchfaceColor: preset.watchfaceColor,
          braceletMaterial: preset.braceletMaterial,
          braceletType: preset.braceletType,
          braceletColor: preset.braceletColor,
          handsEnabled: preset.handsEnabled,
          handsColor: preset.handsColor ?? '#FFFFFF',
          handsStyle: preset.watchfaceText ?? '',
          serialNumber: null,
        }),
      });
      if (!cfgRes.ok) return;
      const cfg = await cfgRes.json();

      const priceRes = await fetch('/api/prices/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchfaceMaterial: preset.watchfaceMaterial,
          braceletMaterial: preset.braceletMaterial,
          handsEnabled: preset.handsEnabled,
        }),
      });
      if (!priceRes.ok) return;
      const price = await priceRes.json();

      const orderRes = await fetch('/api/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configId: cfg.id, sessionId, totalStars: preset.priceStars }),
      });
      if (!orderRes.ok) return;
      const order = await orderRes.json();
      setLocation(`/payment/${order.id}`);
    } catch { /* silent */ }
  }, [preset, sessionId, setLocation]);

  const handleConfigure = useCallback(() => {
    if (!preset) return;
    updateConfig({
      presetId: preset.id, collectionName: preset.collectionName ?? undefined,
      watchfaceGeometry: preset.watchfaceGeometry, watchfaceMaterial: preset.watchfaceMaterial,
      watchfaceColor: preset.watchfaceColor, braceletMaterial: preset.braceletMaterial,
      braceletType: preset.braceletType, braceletColor: preset.braceletColor,
      handsEnabled: preset.handsEnabled, handsColor: preset.handsColor ?? '#cbd5e1',
      watchfaceText: preset.watchfaceText ?? '', watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
      handsCount: 3,
    });
    setLocation('/configure');
  }, [preset, updateConfig, setLocation]);

  // ── Clip / transform per phase ───────────────────────────────────────────
  const isOpen = phase === 'open';
  const isExit = phase === 'exit';

  const clipPath = isOpen
    ? 'inset(0% 0% 0% 0% round 0px)'
    : (originRect.current ? clipStart : 'inset(0% 0% 0% 0% round 0px)');

  const opacity  = isOpen ? 1 : 0;
  const scale    = isOpen ? 1 : 0.94;
  const transition = isOpen
    ? 'clip-path 0.6s cubic-bezier(0.16,1,0.3,1), opacity 0.32s ease, transform 0.6s cubic-bezier(0.16,1,0.3,1)'
    : isExit
      ? 'clip-path 0.48s cubic-bezier(0.4,0,1,1), opacity 0.28s ease 0.1s, transform 0.48s cubic-bezier(0.4,0,1,1)'
      : 'none';

  // ── Loading / not found ──────────────────────────────────────────────────
  if (!preset && (presets as any[])?.length > 0) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0e] flex items-center justify-center text-white/50 text-sm">
        Часы не найдены
        <button onClick={goBack} className="ml-4 underline">← назад</button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-0 flex flex-col md:flex-row overflow-hidden"
      style={{ background: '#0a0a0e', clipPath, opacity, transform: `scale(${scale})`, transition }}
    >
      {/* ── 3D Canvas pane ── */}
      <div className="relative z-10 flex-none h-[58dvh] md:h-auto md:flex-1 md:w-[62%] overflow-hidden">
        {preset && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 35%, ${preset.watchfaceColor}30 0%, ${preset.braceletColor}18 55%, transparent 88%)`,
            }}
          />
        )}

        {WEB_GL_OK ? (
          <WebGLErrorBoundary fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-40 h-56">
                {preset && <WatchSVG config={{
                  watchfaceGeometry: preset.watchfaceGeometry ?? 'rounded',
                  watchfaceColor: preset.watchfaceColor ?? '#888',
                  braceletColor: preset.braceletColor ?? '#333',
                  braceletMaterial: preset.braceletMaterial ?? 'leather',
                  braceletType: preset.braceletType ?? 'strap',
                  handsEnabled: preset.handsEnabled ?? true,
                  handsColor: preset.handsColor ?? '#fff',
                  handsCount: 3,
                  watchfaceText: preset.watchfaceText ?? '',
                  watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
                  watchfaceBackgroundType: 'solid',
                }} />}
              </div>
            </div>
          }>
            <Canvas
              camera={{ position: [0, 0.5, 8.0], fov: 40 }}
              gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
              style={{ width: '100%', height: '100%', background: 'transparent' }}
              dpr={[1, 2]}
              shadows
            >
              <WatchScene />
            </Canvas>
          </WebGLErrorBoundary>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-40 h-56">
              {preset && <WatchSVG config={{
                watchfaceGeometry: preset.watchfaceGeometry ?? 'rounded',
                watchfaceColor: preset.watchfaceColor ?? '#888',
                braceletColor: preset.braceletColor ?? '#333',
                braceletMaterial: preset.braceletMaterial ?? 'leather',
                braceletType: preset.braceletType ?? 'strap',
                handsEnabled: preset.handsEnabled ?? true,
                handsColor: preset.handsColor ?? '#fff',
                handsCount: 3,
                watchfaceText: preset.watchfaceText ?? '',
                watchfaceTextMode: preset.watchfaceTextMode ?? 'center',
                watchfaceBackgroundType: 'solid',
              }} />}
            </div>
          </div>
        )}

        {/* Back button */}
        <button
          onClick={goBack}
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white transition-colors"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(12px)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        {preset?.collectionName && (
          <div
            className="absolute top-4 right-4 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest"
            style={{ background: 'rgba(255,255,255,0.10)', backdropFilter: 'blur(12px)', color: 'rgba(255,255,255,0.7)' }}
          >
            {preset.collectionName}
          </div>
        )}

        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <span className="text-[10px] uppercase tracking-[0.25em] text-white/22 font-semibold">Потяни · Прокрути</span>
        </div>
      </div>

      {/* ── Info panel ── */}
      <div
        className="relative z-10 flex-none h-[42dvh] md:h-auto md:w-[38%] flex flex-col justify-between"
        style={{
          background: 'rgba(10,10,14,0.97)',
          backdropFilter: 'blur(32px)',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div className="px-6 pt-6 pb-4 flex-1 flex flex-col justify-center gap-4">
          {preset ? (
            <>
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-white/30 mb-1">
                  {preset.collectionName ?? 'Классика'}
                </p>
                <h2 className="text-2xl font-black tracking-tight text-white leading-tight mb-1">
                  {preset.name}
                </h2>
                {preset.description && (
                  <p className="text-xs text-white/38 leading-relaxed line-clamp-3">{preset.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {[
                  ['Корпус', MAT_LABELS[preset.watchfaceMaterial] ?? preset.watchfaceMaterial],
                  ['Форма', preset.watchfaceGeometry],
                  ['Ремешок', MAT_LABELS[preset.braceletMaterial] ?? preset.braceletMaterial],
                  ['Стрелки', preset.handsEnabled ? '3 стрелки' : 'без стрелок'],
                ].map(([k, v]) => (
                  <div key={k} className="rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <p className="text-[10px] uppercase tracking-widest text-white/28 mb-0.5">{k}</p>
                    <p className="text-xs font-bold text-white capitalize">{v}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{preset.priceStars}</span>
                <span className="text-sm text-white/30">звёзд Telegram</span>
              </div>
            </>
          ) : (
            /* Skeleton while presets load */
            <div className="flex flex-col gap-3">
              <div className="h-4 w-24 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <div className="h-8 w-48 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <div className="grid grid-cols-2 gap-2">
                {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />)}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-4 flex flex-col gap-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleBuy}
            disabled={!preset}
            className="w-full py-3.5 rounded-2xl font-black text-sm tracking-widest uppercase transition-all active:scale-[0.98] disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff',
              boxShadow: '0 4px 24px rgba(99,102,241,0.35)',
            }}
          >
            {preset ? `Заказать — ${preset.priceStars} зв.` : '…'}
          </button>
          <button
            onClick={handleConfigure}
            disabled={!preset}
            className="w-full py-3 rounded-2xl text-sm font-bold tracking-wide text-white/55 hover:text-white/85 transition-colors disabled:opacity-40"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            Настроить ремешок и цвет →
          </button>
        </div>
      </div>
    </div>
  );
}
