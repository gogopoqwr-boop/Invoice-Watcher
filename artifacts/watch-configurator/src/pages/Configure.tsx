import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WatchModel from '@/components/WatchModel';
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
import { useLocation } from 'wouter';
import { cn } from '@/lib/utils';

function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

const STEPS = [
  { id: 'shape', label: 'Форма' },
  { id: 'material', label: 'Материал' },
  { id: 'color', label: 'Цвет' },
  { id: 'bracelet', label: 'Ремешок' },
  { id: 'details', label: 'Детали' },
];

const GEOMETRIES: { value: WatchConfigInputWatchfaceGeometry; label: string }[] = [
  { value: 'circle', label: 'Круг' },
  { value: 'square', label: 'Квадрат' },
  { value: 'cushion', label: 'Подушка' },
  { value: 'tonneau', label: 'Бочонок' },
];

const FACE_MATERIALS: { value: WatchConfigInputWatchfaceMaterial; label: string }[] = [
  { value: 'metal', label: 'Металл' },
  { value: 'titanium', label: 'Титан' },
  { value: 'ceramic', label: 'Керамика' },
  { value: 'carbon', label: 'Карбон' },
];

const BRACELET_MATERIALS: { value: WatchConfigInputBraceletMaterial; label: string }[] = [
  { value: 'metal_solid', label: 'Металл' },
  { value: 'metal_mesh', label: 'Сетка' },
  { value: 'rubber', label: 'Резина' },
  { value: 'leather', label: 'Кожа' },
  { value: 'nato', label: 'NATO' },
];

const BRACELET_TYPES: { value: WatchConfigInputBraceletType; label: string }[] = [
  { value: 'solid', label: 'Монолитный' },
  { value: 'link', label: 'Звеньевой' },
  { value: 'mesh', label: 'Плетёный' },
  { value: 'rubber', label: 'Силиконовый' },
];

const FACE_COLORS = ['#1e293b', '#0f172a', '#c0c0c0', '#b8860b', '#1e3a5f', '#3b0764', '#1a1a1a', '#f8fafc'];
const STRAP_COLORS = ['#0f172a', '#1e293b', '#78350f', '#1c1917', '#064e3b', '#1e1b4b', '#c0c0c0', '#7f1d1d'];
const HAND_COLORS = ['#cbd5e1', '#f8fafc', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#1e293b'];

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-8 h-8 rounded-full transition-all duration-150 border-2 shrink-0',
        selected ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105 border border-black/10'
      )}
      style={{ backgroundColor: color }}
    />
  );
}

function OptionPills<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn('option-btn', value === o.value && 'active')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Watch3DView() {
  return (
    <Canvas shadows camera={{ position: [0, 5, 8], fov: 40 }} gl={{ failIfMajorPerformanceCaveat: false }}>
      <ambientLight intensity={0.5} />
      <spotLight position={[5, 10, 5]} angle={0.25} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={0.8} color="#4f46e5" />
      <Suspense fallback={null}>
        <WatchModel />
        <Environment preset="city" />
        <ContactShadows position={[0, -2, 0]} opacity={0.3} scale={12} blur={2} far={5} />
      </Suspense>
      <OrbitControls enablePan={false} minPolarAngle={Math.PI / 4} maxPolarAngle={Math.PI / 2} minDistance={4} maxDistance={12} />
    </Canvas>
  );
}

export default function Configure() {
  const { config, updateConfig, sessionId } = useWatchConfig();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [serialNumber, setSerialNumber] = useState(config.serialNumber ?? '');
  const [submitting, setSubmitting] = useState(false);

  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  const createConfig = useCreateConfiguration();
  const createOrder = useCreateOrder();
  const calcPrice = useCalculatePrice();

  const handleOrder = async () => {
    setSubmitting(true);
    try {
      const cfg = await createConfig.mutateAsync({
        ...config,
        serialNumber: serialNumber || undefined,
        sessionId,
      });
      const priceResult = await calcPrice.mutateAsync({ configId: cfg.id, sessionId });
      const order = await createOrder.mutateAsync({
        configId: cfg.id,
        sessionId,
        totalStars: priceResult.totalStars,
        customerNote: undefined,
      });
      setLocation(`/payment/${order.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => setStep(s => Math.max(0, s - 1));
  const goNext = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else handleOrder();
  };

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col md:flex-row overflow-hidden">

      {/* Left — Watch Preview */}
      <div className="w-full md:w-[52%] h-[40vh] md:h-screen relative bg-gradient-to-br from-slate-50 to-blue-50/30">
        {webglAvailable ? (
          <WebGLErrorBoundary fallback={<div className="w-full h-full flex items-center justify-center p-8"><WatchSVG /></div>}>
            <Watch3DView />
          </WebGLErrorBoundary>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8">
            <WatchSVG />
          </div>
        )}
      </div>

      {/* Right — Step Panel */}
      <div className="w-full md:w-[48%] md:h-screen flex flex-col bg-background/80 backdrop-blur-xl border-l border-border/60">

        {/* Progress Bar */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-1">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.id}>
                <button
                  onClick={() => setStep(i)}
                  className={cn(
                    'flex flex-col items-center gap-1 transition-all',
                    i <= step ? 'opacity-100' : 'opacity-35'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all',
                    i < step ? 'bg-primary border-primary text-white' :
                    i === step ? 'border-primary text-primary bg-primary/10' :
                    'border-border text-muted-foreground'
                  )}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <span className={cn(
                    'text-[10px] uppercase tracking-wider font-medium hidden sm:block',
                    i === step ? 'text-primary' : 'text-muted-foreground'
                  )}>
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={cn('flex-1 h-0.5 rounded-full transition-all', i < step ? 'bg-primary' : 'bg-border')} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5">

          {/* Step 0 — Shape */}
          {step === 0 && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold tracking-tight">Форма корпуса</h2>
              <OptionPills options={GEOMETRIES} value={config.watchfaceGeometry} onChange={v => updateConfig({ watchfaceGeometry: v })} />
            </div>
          )}

          {/* Step 1 — Material */}
          {step === 1 && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl font-bold tracking-tight">Материал</h2>
              <OptionPills options={FACE_MATERIALS} value={config.watchfaceMaterial} onChange={v => updateConfig({ watchfaceMaterial: v })} />
            </div>
          )}

          {/* Step 2 — Colors */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-3">Цвет корпуса</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  {FACE_COLORS.map(c => <ColorSwatch key={c} color={c} selected={config.watchfaceColor === c} onClick={() => updateConfig({ watchfaceColor: c })} />)}
                  <input type="color" value={config.watchfaceColor} onChange={e => updateConfig({ watchfaceColor: e.target.value })}
                    className="w-8 h-8 rounded-full cursor-pointer border border-black/10 bg-transparent" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-3">Цвет ремешка</h2>
                <div className="flex flex-wrap gap-2 items-center">
                  {STRAP_COLORS.map(c => <ColorSwatch key={c} color={c} selected={config.braceletColor === c} onClick={() => updateConfig({ braceletColor: c })} />)}
                  <input type="color" value={config.braceletColor} onChange={e => updateConfig({ braceletColor: e.target.value })}
                    className="w-8 h-8 rounded-full cursor-pointer border border-black/10 bg-transparent" />
                </div>
              </div>
            </div>
          )}

          {/* Step 3 — Bracelet */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <h2 className="text-xl font-bold tracking-tight mb-3">Материал ремешка</h2>
                <OptionPills options={BRACELET_MATERIALS} value={config.braceletMaterial} onChange={v => updateConfig({ braceletMaterial: v })} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">Тип</h3>
                <OptionPills options={BRACELET_TYPES} value={config.braceletType} onChange={v => updateConfig({ braceletType: v })} />
              </div>
            </div>
          )}

          {/* Step 4 — Details */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xl font-bold tracking-tight">Стрелки</h2>
                  <button
                    onClick={() => updateConfig({ handsEnabled: !config.handsEnabled })}
                    className={cn(
                      'w-12 h-6 rounded-full transition-all relative border',
                      config.handsEnabled ? 'bg-primary border-primary' : 'bg-border border-border'
                    )}
                  >
                    <span className={cn(
                      'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all',
                      config.handsEnabled ? 'left-6' : 'left-0.5'
                    )} />
                  </button>
                </div>
                {config.handsEnabled && (
                  <div className="flex flex-wrap gap-2">
                    {HAND_COLORS.map(c => <ColorSwatch key={c} color={c} selected={config.handsColor === c} onClick={() => updateConfig({ handsColor: c })} />)}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-2">Серийный номер</h3>
                <input
                  type="text"
                  maxLength={20}
                  placeholder="NA4-XXXXXXXX"
                  value={serialNumber}
                  onChange={e => setSerialNumber(e.target.value.toUpperCase())}
                  className="w-full bg-white/70 border border-border rounded-full px-4 py-2.5 text-sm font-mono tracking-widest text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>

              {/* Summary */}
              <div className="liquid-glass rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Форма</span><span className="font-medium capitalize">{config.watchfaceGeometry}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Материал</span><span className="font-medium capitalize">{config.watchfaceMaterial}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Ремешок</span><span className="font-medium capitalize">{config.braceletMaterial}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Стрелки</span><span className="font-medium">{config.handsEnabled ? 'Да' : 'Нет'}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="px-6 pb-6 pt-3 border-t border-border/40 flex gap-3">
          {step > 0 && (
            <button
              onClick={goBack}
              className="liquid-button flex-none px-6 py-3 text-sm font-semibold"
            >
              ← Назад
            </button>
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
            {step === STEPS.length - 1
              ? (submitting ? 'Оформление...' : 'Оформить заказ →')
              : `Далее: ${STEPS[step + 1].label} →`}
          </button>
        </div>
      </div>
    </div>
  );
}
