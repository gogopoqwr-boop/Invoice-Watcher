import React, { Suspense, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import WatchModel from '@/components/WatchModel';
import WatchSVG from '@/components/WatchSVG';
import { WebGLErrorBoundary } from '@/components/WebGLErrorBoundary';
import { GlassPanel } from '@/components/ui/glass-panel';
import { LiquidButton } from '@/components/ui/liquid-button';
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

const WATCH_COLORS = [
  '#1e293b', '#0f172a', '#c0c0c0', '#b8860b',
  '#1e3a5f', '#3b0764', '#1a1a1a', '#f8fafc',
];

const STRAP_COLORS = [
  '#0f172a', '#1e293b', '#78350f', '#1c1917',
  '#064e3b', '#1e1b4b', '#c0c0c0', '#7f1d1d',
];

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-8 h-8 rounded-full transition-all duration-150 border-2',
        selected ? 'border-primary scale-110 shadow-lg' : 'border-transparent hover:scale-105'
      )}
      style={{ backgroundColor: color }}
    />
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground uppercase tracking-widest mb-2">{children}</p>;
}

function Watch3DView() {
  return (
    <Canvas shadows camera={{ position: [0, 5, 8], fov: 40 }} gl={{ failIfMajorPerformanceCaveat: false }}>
      <ambientLight intensity={0.3} />
      <spotLight position={[5, 10, 5]} angle={0.25} penumbra={1} intensity={2} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={1} color="#4f46e5" />
      <pointLight position={[5, -5, 5]} intensity={1} color="#06b6d4" />
      <Suspense fallback={null}>
        <WatchModel />
        <Environment preset="city" />
        <ContactShadows position={[0, -2, 0]} opacity={0.5} scale={12} blur={2} far={5} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
        minDistance={4}
        maxDistance={12}
      />
    </Canvas>
  );
}

export default function Configure() {
  const { config, updateConfig, activePart, setActivePart, sessionId } = useWatchConfig();
  const [, setLocation] = useLocation();
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

      const priceResult = await calcPrice.mutateAsync({
        configId: cfg.id,
        sessionId,
      });

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

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col md:flex-row overflow-hidden relative text-white">

      {/* Left — 3D/2D Watch View */}
      <div className="w-full md:w-[55%] h-[45vh] md:h-screen relative bg-black/20">
        {webglAvailable ? (
          <WebGLErrorBoundary
            fallback={
              <div className="w-full h-full flex items-center justify-center p-8">
                <WatchSVG />
              </div>
            }
          >
            <Watch3DView />
          </WebGLErrorBoundary>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-8">
            <WatchSVG />
          </div>
        )}

        {activePart && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-panel px-4 py-1 rounded-full text-xs tracking-widest text-primary">
            {activePart === 'watchFace' ? 'КОРПУС' : activePart === 'strap' ? 'РЕМЕШОК' : 'ЗАСТЁЖКА'}
          </div>
        )}
      </div>

      {/* Right — Config Panel */}
      <div className="w-full md:w-[45%] md:h-screen flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">

          {/* Part Selector */}
          <GlassPanel className="p-4">
            <SectionLabel>Выбрать часть</SectionLabel>
            <div className="flex gap-2">
              {(['watchFace', 'strap', 'clasp'] as const).map(part => (
                <button
                  key={part}
                  onClick={() => setActivePart(activePart === part ? null : part)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all',
                    activePart === part
                      ? 'bg-primary text-white'
                      : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                  )}
                >
                  {part === 'watchFace' ? 'Корпус' : part === 'strap' ? 'Ремешок' : 'Застёжка'}
                </button>
              ))}
            </div>
          </GlassPanel>

          {/* Watchface */}
          <GlassPanel className="p-4 space-y-4">
            <h3 className="font-bold tracking-widest text-sm">КОРПУС</h3>

            <div>
              <SectionLabel>Форма</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {GEOMETRIES.map(g => (
                  <button
                    key={g.value}
                    onClick={() => updateConfig({ watchfaceGeometry: g.value })}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-all',
                      config.watchfaceGeometry === g.value
                        ? 'bg-primary text-white'
                        : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Материал</SectionLabel>
              <div className="grid grid-cols-4 gap-2">
                {FACE_MATERIALS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => updateConfig({ watchfaceMaterial: m.value })}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-all',
                      config.watchfaceMaterial === m.value
                        ? 'bg-primary text-white'
                        : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Цвет корпуса</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {WATCH_COLORS.map(c => (
                  <ColorSwatch key={c} color={c} selected={config.watchfaceColor === c} onClick={() => updateConfig({ watchfaceColor: c })} />
                ))}
                <input
                  type="color"
                  value={config.watchfaceColor}
                  onChange={e => updateConfig({ watchfaceColor: e.target.value })}
                  className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
                  title="Custom color"
                />
              </div>
            </div>
          </GlassPanel>

          {/* Bracelet */}
          <GlassPanel className="p-4 space-y-4">
            <h3 className="font-bold tracking-widest text-sm">РЕМЕШОК</h3>

            <div>
              <SectionLabel>Материал</SectionLabel>
              <div className="grid grid-cols-3 gap-2">
                {BRACELET_MATERIALS.map(m => (
                  <button
                    key={m.value}
                    onClick={() => updateConfig({ braceletMaterial: m.value })}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-all',
                      config.braceletMaterial === m.value
                        ? 'bg-primary text-white'
                        : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Тип</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {BRACELET_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => updateConfig({ braceletType: t.value })}
                    className={cn(
                      'py-2 rounded-lg text-xs font-medium transition-all',
                      config.braceletType === t.value
                        ? 'bg-primary text-white'
                        : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Цвет ремешка</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {STRAP_COLORS.map(c => (
                  <ColorSwatch key={c} color={c} selected={config.braceletColor === c} onClick={() => updateConfig({ braceletColor: c })} />
                ))}
                <input
                  type="color"
                  value={config.braceletColor}
                  onChange={e => updateConfig({ braceletColor: e.target.value })}
                  className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
                  title="Custom color"
                />
              </div>
            </div>
          </GlassPanel>

          {/* Hands */}
          <GlassPanel className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold tracking-widest text-sm">СТРЕЛКИ</h3>
              <button
                onClick={() => updateConfig({ handsEnabled: !config.handsEnabled })}
                className={cn(
                  'w-12 h-6 rounded-full transition-all relative',
                  config.handsEnabled ? 'bg-primary' : 'bg-white/10'
                )}
              >
                <span className={cn(
                  'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                  config.handsEnabled ? 'left-7' : 'left-1'
                )} />
              </button>
            </div>

            {config.handsEnabled && (
              <div>
                <SectionLabel>Цвет стрелок</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  {['#cbd5e1', '#f8fafc', '#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#1e293b'].map(c => (
                    <ColorSwatch key={c} color={c} selected={config.handsColor === c} onClick={() => updateConfig({ handsColor: c })} />
                  ))}
                </div>
              </div>
            )}
          </GlassPanel>

          {/* Serial Number */}
          <GlassPanel className="p-4">
            <SectionLabel>Серийный номер (опционально)</SectionLabel>
            <input
              type="text"
              maxLength={20}
              placeholder="NA4-XXXXXXXX"
              value={serialNumber}
              onChange={e => setSerialNumber(e.target.value.toUpperCase())}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono tracking-widest text-white placeholder:text-white/20 focus:outline-none focus:border-primary/50"
            />
          </GlassPanel>

        </div>

        {/* CTA */}
        <div className="p-4 md:p-6 border-t border-white/5">
          <LiquidButton
            onClick={handleOrder}
            disabled={submitting}
            className="w-full h-12 text-sm font-bold tracking-widest"
          >
            {submitting ? 'ОФОРМЛЕНИЕ...' : 'ОФОРМИТЬ ЗАКАЗ →'}
          </LiquidButton>
        </div>
      </div>

    </div>
  );
}
