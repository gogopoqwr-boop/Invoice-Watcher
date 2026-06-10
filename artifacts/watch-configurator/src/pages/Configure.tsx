import React, { Suspense, useState, useMemo, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WatchModel, { CameraRig } from '@/components/WatchModel';
import WatchSVG from '@/components/WatchSVG';
import { WebGLErrorBoundary } from '@/components/WebGLErrorBoundary';
import { useWatchConfig } from '@/hooks/use-watch-config';
import {
  useCreateConfiguration,
  useCreateOrder,
  useCalculatePrice,
  WatchConfigInputWatchfaceGeometry,
  WatchConfigInputWatchfaceMaterial,
  WatchConfigInputBraceletMaterial,
  WatchConfigInputBraceletType,
} from '@workspace/api-client-react';
import { useLocation, Link } from 'wouter';
import { cn } from '@/lib/utils';

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch { return false; }
}

const STEPS = [
  { id: 'shape', label: 'Форма' },
  { id: 'material', label: 'Материал' },
  { id: 'bracelet', label: 'Ремешок' },
  { id: 'color', label: 'Цвет' },
  { id: 'details', label: 'Детали' },
];

const GEOMETRIES: { value: WatchConfigInputWatchfaceGeometry; label: string; desc: string }[] = [
  { value: 'circle', label: 'Круг', desc: 'Классика' },
  { value: 'square', label: 'Квадрат', desc: 'Брутально' },
  { value: 'star', label: 'Звезда', desc: 'Нестандарт' },
  { value: 'drawn', label: 'Подушка', desc: 'Мягко' },
];

const FACE_MATERIALS: { value: WatchConfigInputWatchfaceMaterial; label: string; desc: string }[] = [
  { value: 'metal', label: 'Нержавейка', desc: 'Прочный' },
  { value: 'plastic', label: 'Пластик', desc: 'Лёгкий' },
];

const BRACELET_MATERIALS: { value: WatchConfigInputBraceletMaterial; label: string; desc: string; pattern: string }[] = [
  { value: 'metal_solid', label: 'Металл', desc: 'Монолитный', pattern: '▬▬▬' },
  { value: 'metal_segmented', label: 'Сетка', desc: 'Плетёная', pattern: '≡≡≡' },
  { value: 'plastic_solid', label: 'Резина', desc: 'Силикон', pattern: '━━━' },
  { value: 'leather', label: 'Кожа', desc: 'Натуральная', pattern: '───' },
  { value: 'cotton_fabric', label: 'NATO', desc: 'Нейлон', pattern: '═══' },
  { value: 'resin', label: 'Смола', desc: 'Полупроз.', pattern: '···' },
];

const BRACELET_TYPES: { value: WatchConfigInputBraceletType; label: string }[] = [
  { value: 'solid', label: 'Монолитный' },
  { value: 'segmented', label: 'Звеньевой' },
];

const FACE_COLORS = ['#0f172a', '#1e293b', '#c0c0c0', '#b8860b', '#1e3a5f', '#3b0764', '#7f1d1d', '#f8fafc'];
const STRAP_COLORS = ['#0f172a', '#1e293b', '#78350f', '#1c1917', '#064e3b', '#1e1b4b', '#c0c0c0', '#374151'];
const HAND_COLORS = ['#f8fafc', '#cbd5e1', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#0f172a'];

const GRADIENT_PRESETS = [
  { label: 'Ночь', from: '#0f172a', to: '#1e3a5f' },
  { label: 'Закат', from: '#7f1d1d', to: '#1e1b4b' },
  { label: 'Лес', from: '#064e3b', to: '#0f172a' },
  { label: 'Хром', from: '#334155', to: '#94a3b8' },
  { label: 'Золото', from: '#78350f', to: '#b8860b' },
  { label: 'Лёд', from: '#1e3a5f', to: '#bfdbfe' },
];

function ColorSwatch({ color, selected, onClick, size = 8 }: { color: string; selected: boolean; onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded-full transition-all duration-150 border-2 shrink-0', selected ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105')}
      style={{ backgroundColor: color, width: size * 4, height: size * 4 }}
    />
  );
}

function OptionCard({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl border-2 p-3 text-left transition-all duration-150',
        selected ? 'border-primary bg-primary/8 shadow-sm' : 'border-border/60 bg-white/50 hover:border-border hover:bg-white/70',
        className
      )}
    >
      {children}
    </button>
  );
}

function Watch3DView({ step, lastInteractionRef }: { step: number; lastInteractionRef: React.RefObject<number> }) {
  const markInteraction = () => {
    (lastInteractionRef as React.MutableRefObject<number>).current = Date.now();
  };

  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      camera={{ position: [0, 0.5, 9], fov: 42 }}
      gl={{ failIfMajorPerformanceCaveat: false, antialias: true }}
    >
      <ambientLight intensity={0.55} />
      <spotLight position={[4, 6, 8]} angle={0.3} penumbra={0.8} intensity={2.5} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-5, 3, -4]} intensity={1.0} color="#6366f1" />
      <pointLight position={[5, -2, 3]} intensity={0.4} color="#f0f4ff" />
      <Suspense fallback={null}>
        <WatchModel step={step} lastInteractionRef={lastInteractionRef} />
        <CameraRig step={step} />
        <Environment preset="city" />
        <ContactShadows position={[0, -5, 0]} opacity={0.25} scale={18} blur={2.5} far={8} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        autoRotate={false}
        minPolarAngle={0}
        maxPolarAngle={Math.PI}
        minDistance={4}
        maxDistance={14}
        onStart={markInteraction}
        onChange={markInteraction}
        onEnd={markInteraction}
      />
    </Canvas>
  );
}

export default function Configure() {
  const { config, updateConfig, sessionId } = useWatchConfig();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Capture config on first mount — used for discard
  const initialConfigRef = useRef<typeof config | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!initialConfigRef.current) {
      initialConfigRef.current = { ...config };
    }
  }, []);

  // Track changes vs initial config
  useEffect(() => {
    if (!initialConfigRef.current) return;
    setHasChanges(JSON.stringify(config) !== JSON.stringify(initialConfigRef.current));
  }, [config]);

  // Shared ref for 3D interaction detection
  const lastInteractionRef = useRef<number>(0);

  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  const createConfig = useCreateConfiguration();
  const createOrder = useCreateOrder();
  const calcPrice = useCalculatePrice();

  const handleDiscard = () => {
    if (initialConfigRef.current) {
      updateConfig(initialConfigRef.current);
      setStep(0);
    }
  };

  const handleOrder = async () => {
    setSubmitting(true);
    try {
      const cfg = await createConfig.mutateAsync({ data: {
        watchfaceGeometry: config.watchfaceGeometry,
        watchfaceMaterial: config.watchfaceMaterial,
        watchfaceColor: config.watchfaceColor,
        braceletMaterial: config.braceletMaterial,
        braceletType: config.braceletType,
        braceletColor: config.braceletColor,
        handsEnabled: config.handsEnabled,
        handsColor: config.handsColor,
        handsStyle: config.watchfaceText || undefined,
        serialNumber: config.serialNumber || undefined,
        sessionId,
      }});
      const priceResult = await calcPrice.mutateAsync({ data: { watchfaceMaterial: config.watchfaceMaterial, braceletMaterial: config.braceletMaterial, handsEnabled: config.handsEnabled } });
      const order = await createOrder.mutateAsync({ data: { configId: cfg.id, sessionId, totalStars: priceResult.totalStars } });
      setLocation(`/payment/${order.id}`);
    } catch (e) { console.error(e); }
    finally { setSubmitting(false); }
  };

  const goBack = () => setStep(s => Math.max(0, s - 1));
  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else handleOrder();
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col md:flex-row overflow-hidden">

      {/* Left — Watch Preview */}
      <div className="w-full md:w-[52%] h-[42vh] md:h-screen relative bg-gradient-to-br from-slate-50 to-blue-50/40">
        {/* Back to collections */}
        <Link href="/collections">
          <button className="absolute top-3 left-3 z-10 liquid-button px-3 py-1.5 text-xs font-semibold">← Коллекции</button>
        </Link>

        {webglAvailable ? (
          <WebGLErrorBoundary fallback={<div className="w-full h-full flex items-center justify-center p-10"><WatchSVG /></div>}>
            <Watch3DView step={step} lastInteractionRef={lastInteractionRef} />
          </WebGLErrorBoundary>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-10">
            <WatchSVG />
          </div>
        )}
      </div>

      {/* Right — Step Panel */}
      <div className="w-full md:w-[48%] md:h-screen flex flex-col bg-background/80 backdrop-blur-xl border-l border-border/60">

        {/* Progress Bar */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <button onClick={() => setStep(i)} className={cn('flex flex-col items-center gap-1 transition-all', i <= step ? 'opacity-100' : 'opacity-35')}>
                  <div className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all', i < step ? 'bg-primary border-primary text-white' : i === step ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground')}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={cn('text-[9px] uppercase tracking-wider font-semibold hidden sm:block', i === step ? 'text-primary' : 'text-muted-foreground')}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && <div className={cn('flex-1 h-0.5 rounded-full transition-all mb-3', i < step ? 'bg-primary' : 'bg-border')} />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">

          {/* STEP 0 — Shape */}
          {step === 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight">Форма корпуса</h2>
              <div className="grid grid-cols-2 gap-3">
                {GEOMETRIES.map(g => (
                  <OptionCard key={g.value} selected={config.watchfaceGeometry === g.value} onClick={() => updateConfig({ watchfaceGeometry: g.value })}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-8 h-8 flex items-center justify-center">
                        <svg viewBox="0 0 24 24" className="w-6 h-6" fill={config.watchfaceGeometry === g.value ? 'hsl(220 90% 55%)' : '#94a3b8'}>
                          {g.value === 'circle' && <circle cx="12" cy="12" r="10" />}
                          {g.value === 'square' && <rect x="2" y="2" width="20" height="20" rx="3" />}
                          {g.value === 'star' && <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />}
                          {g.value === 'drawn' && <rect x="2" y="2" width="20" height="20" rx="8" />}
                        </svg>
                      </div>
                      <div>
                        <p className={cn('text-sm font-bold', config.watchfaceGeometry === g.value ? 'text-primary' : 'text-foreground')}>{g.label}</p>
                        <p className="text-xs text-muted-foreground">{g.desc}</p>
                      </div>
                    </div>
                  </OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* STEP 1 — Material */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold tracking-tight">Материал корпуса</h2>
              <div className="grid grid-cols-2 gap-3">
                {FACE_MATERIALS.map(m => (
                  <OptionCard key={m.value} selected={config.watchfaceMaterial === m.value} onClick={() => updateConfig({ watchfaceMaterial: m.value })}>
                    <p className={cn('text-sm font-bold', config.watchfaceMaterial === m.value ? 'text-primary' : '')}>{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </OptionCard>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2 — Bracelet */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-3">Материал ремешка</h2>
                <div className="grid grid-cols-2 gap-3">
                  {BRACELET_MATERIALS.map(m => (
                    <OptionCard key={m.value} selected={config.braceletMaterial === m.value} onClick={() => updateConfig({ braceletMaterial: m.value })}>
                      <div className="flex items-center justify-between mb-0.5">
                        <p className={cn('text-sm font-bold', config.braceletMaterial === m.value ? 'text-primary' : '')}>{m.label}</p>
                        <span className="text-base leading-none">{m.pattern}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </OptionCard>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Тип застёжки</p>
                <div className="flex flex-wrap gap-2">
                  {BRACELET_TYPES.map(t => (
                    <button key={t.value} onClick={() => updateConfig({ braceletType: t.value })} className={cn('option-btn', config.braceletType === t.value && 'active')}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Colors */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-3">Цвет корпуса</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  {FACE_COLORS.map(c => <ColorSwatch key={c} color={c} selected={config.watchfaceColor === c} onClick={() => updateConfig({ watchfaceColor: c })} />)}
                  <input type="color" value={config.watchfaceColor} onChange={e => updateConfig({ watchfaceColor: e.target.value })} className="w-8 h-8 rounded-full cursor-pointer border border-black/10 bg-transparent" />
                </div>
              </div>

              <div>
                <p className="text-sm font-bold mb-2">Фон циферблата</p>
                <div className="flex gap-2 mb-3">
                  <button onClick={() => updateConfig({ watchfaceBackgroundType: 'solid' })} className={cn('option-btn flex-1', config.watchfaceBackgroundType === 'solid' ? 'active' : '')}>Однотонный</button>
                  <button onClick={() => updateConfig({ watchfaceBackgroundType: 'gradient' })} className={cn('option-btn flex-1', config.watchfaceBackgroundType === 'gradient' ? 'active' : '')}>Градиент</button>
                </div>
                {config.watchfaceBackgroundType === 'gradient' && (
                  <>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {GRADIENT_PRESETS.map(gp => (
                        <button
                          key={gp.label}
                          onClick={() => updateConfig({ watchfaceColor: gp.from, watchfaceGradientEnd: gp.to })}
                          className="rounded-xl h-10 text-xs font-semibold text-white shadow-sm hover:scale-105 transition-all"
                          style={{ background: `linear-gradient(135deg, ${gp.from}, ${gp.to})` }}
                        >
                          {gp.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={config.watchfaceColor} onChange={e => updateConfig({ watchfaceColor: e.target.value })} className="w-8 h-8 rounded-full cursor-pointer border border-black/10" />
                      <div className="flex-1 h-0.5 rounded-full" style={{ background: `linear-gradient(to right, ${config.watchfaceColor}, ${config.watchfaceGradientEnd})` }} />
                      <input type="color" value={config.watchfaceGradientEnd} onChange={e => updateConfig({ watchfaceGradientEnd: e.target.value })} className="w-8 h-8 rounded-full cursor-pointer border border-black/10" />
                    </div>
                  </>
                )}
              </div>

              <div>
                <p className="text-sm font-bold mb-2">Цвет ремешка</p>
                <div className="flex flex-wrap gap-2 items-center">
                  {STRAP_COLORS.map(c => <ColorSwatch key={c} color={c} selected={config.braceletColor === c} onClick={() => updateConfig({ braceletColor: c })} />)}
                  <input type="color" value={config.braceletColor} onChange={e => updateConfig({ braceletColor: e.target.value })} className="w-8 h-8 rounded-full cursor-pointer border border-black/10 bg-transparent" />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — Details */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-1">Надпись на циферблате</h2>
                <p className="text-xs text-muted-foreground mb-2">До 4 строк. Каждая строка — отдельная строчка текста.</p>
                <textarea
                  rows={4}
                  maxLength={60}
                  placeholder={"НА УТРАХ\nMUCHO\nДОХУИЩА"}
                  value={config.watchfaceText ?? ''}
                  onChange={e => updateConfig({ watchfaceText: e.target.value })}
                  className="w-full bg-white/60 border border-border rounded-2xl px-4 py-3 text-sm font-mono tracking-wider text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all resize-none uppercase"
                />
                <p className="text-xs text-muted-foreground text-right mt-1">{(config.watchfaceText ?? '').length}/60</p>
              </div>

              <div>
                <p className="text-sm font-bold mb-2">Количество стрелок</p>
                <div className="flex gap-2">
                  {[0, 2, 3].map(n => (
                    <button
                      key={n}
                      onClick={() => updateConfig({ handsEnabled: n > 0, handsCount: n })}
                      className={cn('option-btn flex-1', (config.handsCount ?? 3) === n && n > 0 ? 'active' : !config.handsEnabled && n === 0 ? 'active' : '')}
                    >
                      {n === 0 ? 'Без стрелок' : n === 2 ? '2 стрелки' : '3 стрелки'}
                    </button>
                  ))}
                </div>
              </div>

              {config.handsEnabled && (
                <div>
                  <p className="text-sm font-bold mb-2">Цвет стрелок</p>
                  <div className="flex flex-wrap gap-2">
                    {HAND_COLORS.map(c => <ColorSwatch key={c} color={c} selected={config.handsColor === c} onClick={() => updateConfig({ handsColor: c })} />)}
                    <input type="color" value={config.handsColor} onChange={e => updateConfig({ handsColor: e.target.value })} className="w-8 h-8 rounded-full cursor-pointer border border-black/10" />
                  </div>
                </div>
              )}

              <div>
                <p className="text-sm font-bold mb-2">Серийный номер <span className="text-muted-foreground font-normal">(опционально)</span></p>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="NA4-XXXXXXXX"
                  value={config.serialNumber ?? ''}
                  onChange={e => updateConfig({ serialNumber: e.target.value.toUpperCase() })}
                  className="w-full bg-white/60 border border-border rounded-full px-4 py-2.5 text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Summary */}
              <div className="liquid-glass rounded-2xl p-4 space-y-2 text-sm">
                {(
                  [
                    ['Форма', config.watchfaceGeometry],
                    ['Материал', config.watchfaceMaterial],
                    ['Ремешок', config.braceletMaterial],
                    ['Стрелки', config.handsEnabled ? `${config.handsCount ?? 3} шт.` : 'нет'],
                    ...(config.watchfaceText ? [['Надпись', '✓']] : []),
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-medium capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-5 pb-5 pt-3 border-t border-border/40 space-y-2">
          {/* Discard row — only visible when there are unsaved changes */}
          {hasChanges && (
            <div className="flex justify-center">
              <button
                onClick={handleDiscard}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2"
              >
                Сбросить изменения
              </button>
            </div>
          )}
          <div className="flex gap-3">
            {step > 0 && (
              <button onClick={goBack} className="liquid-button flex-none px-5 py-3 text-sm font-semibold">← Назад</button>
            )}
            <button
              onClick={goNext}
              disabled={submitting}
              className={cn(
                'flex-1 py-3 rounded-full text-sm font-bold tracking-widest uppercase transition-all',
                step === STEPS.length - 1
                  ? 'bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60'
                  : 'liquid-button'
              )}
            >
              {step === STEPS.length - 1 ? (submitting ? 'Оформление...' : 'Оформить заказ →') : `Далее: ${STEPS[step + 1].label} →`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
