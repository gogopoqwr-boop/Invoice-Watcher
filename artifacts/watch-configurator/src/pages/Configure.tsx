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

const BRACELET_MATERIALS: { value: WatchConfigInputBraceletMaterial; label: string; desc: string; pattern: string }[] = [
  { value: 'metal_solid', label: 'Металл', desc: 'Монолитный', pattern: '▬▬▬' },
  { value: 'metal_segmented', label: 'Сетка', desc: 'Плетёная', pattern: '≡≡≡' },
  { value: 'plastic_solid', label: 'Резина', desc: 'Силикон', pattern: '━━━' },
  { value: 'leather', label: 'Кожа', desc: 'Натуральная', pattern: '───' },
  { value: 'cotton_fabric', label: 'NATO', desc: 'Нейлон', pattern: '═══' },
  { value: 'resin', label: 'Смола', desc: 'Полупроз.', pattern: '···' },
];

const BRACELET_TYPES: { value: WatchConfigInputBraceletType; label: string; desc: string }[] = [
  { value: 'solid', label: 'Монолитная', desc: 'Скрытая кнопка-замок' },
  { value: 'segmented', label: 'Звеньевая', desc: 'Раскладная застёжка' },
];

const STRAP_COLORS = ['#0f172a', '#1e293b', '#78350f', '#1c1917', '#064e3b', '#1e1b4b', '#c0c0c0', '#374151'];

function ColorSwatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn('rounded-full transition-all duration-150 border-2 shrink-0', selected ? 'border-primary scale-110 shadow-md' : 'border-transparent hover:scale-105')}
      style={{ backgroundColor: color, width: 32, height: 32 }}
    />
  );
}

function OptionCard({ selected, onClick, children, className }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-2xl border-2 p-3 text-left transition-all duration-150',
        selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/60 bg-card/60 hover:border-border hover:bg-card/80',
        className
      )}
    >
      {children}
    </button>
  );
}

function PresentationBox() {
  const boxColor = '#0f172a';
  const boxMat = { color: boxColor, metalness: 0.72, roughness: 0.22 };
  const accentMat = { color: '#1e293b', metalness: 0.55, roughness: 0.35 };
  return (
    <group position={[0, -6.2, 0]}>
      {/* Base platform */}
      <mesh receiveShadow castShadow>
        <boxGeometry args={[5.2, 0.3, 3.2]} />
        <meshStandardMaterial {...boxMat} />
      </mesh>
      {/* Watch cushion/pillow */}
      <mesh position={[0, 0.32, 0]} receiveShadow>
        <boxGeometry args={[1.8, 0.35, 1.0]} />
        <meshStandardMaterial color="#1e293b" roughness={0.95} metalness={0} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-2.5, 1.4, 0]} receiveShadow>
        <boxGeometry args={[0.22, 2.5, 3.2]} />
        <meshStandardMaterial {...boxMat} />
      </mesh>
      {/* Right wall */}
      <mesh position={[2.5, 1.4, 0]} receiveShadow>
        <boxGeometry args={[0.22, 2.5, 3.2]} />
        <meshStandardMaterial {...boxMat} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.4, -1.5]} receiveShadow>
        <boxGeometry args={[5.2, 2.5, 0.22]} />
        <meshStandardMaterial {...boxMat} />
      </mesh>
      {/* Front lip */}
      <mesh position={[0, 0.5, 1.5]} receiveShadow>
        <boxGeometry args={[5.2, 0.7, 0.22]} />
        <meshStandardMaterial {...boxMat} />
      </mesh>
      {/* Inner floor */}
      <mesh position={[0, 0.17, 0]} receiveShadow>
        <boxGeometry args={[5.0, 0.06, 3.0]} />
        <meshStandardMaterial {...accentMat} />
      </mesh>
      {/* Bottom logo strip */}
      <mesh position={[0, -0.16, 0.6]} receiveShadow>
        <boxGeometry args={[2.4, 0.01, 0.06]} />
        <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

function Watch3DView({ lastInteractionRef, showWrist }: { lastInteractionRef: React.RefObject<number>; showWrist: boolean }) {
  const BRACELET_STEP = 2;
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
      <pointLight position={[0, -5, 4]} intensity={0.3} color="#c4b5fd" />
      <Suspense fallback={null}>
        <WatchModel step={BRACELET_STEP} lastInteractionRef={lastInteractionRef} showWrist={showWrist} />
        <CameraRig step={BRACELET_STEP} lastInteractionRef={lastInteractionRef} />
        <PresentationBox />
        <Environment preset="city" />
        <ContactShadows position={[0, -5.9, 0]} opacity={0.55} scale={14} blur={2.0} far={6} />
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
  const hasPreset = !!config.presetId;

  useEffect(() => {
    if (!hasPreset) setLocation('/collections');
  }, [hasPreset]);

  const [submitting, setSubmitting] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [showWrist, setShowWrist] = useState(false);
  const lastInteractionRef = useRef<number>(0);
  const webglAvailable = useMemo(() => isWebGLAvailable(), []);

  const createConfig = useCreateConfiguration();
  const createOrder = useCreateOrder();
  const calcPrice = useCalculatePrice();

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        setPriceLoading(true);
        const result = await calcPrice.mutateAsync({
          data: {
            watchfaceMaterial: config.watchfaceMaterial,
            braceletMaterial: config.braceletMaterial,
            handsEnabled: config.handsEnabled,
          },
        });
        setLivePrice(result.totalStars);
      } catch {
        // keep last known price
      } finally {
        setPriceLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.braceletMaterial, config.watchfaceMaterial, config.handsEnabled]);

  const handleOrder = async () => {
    setSubmitting(true);
    try {
      const cfg = await createConfig.mutateAsync({
        data: {
          watchfaceGeometry: config.watchfaceGeometry,
          watchfaceMaterial: config.watchfaceMaterial,
          watchfaceColor: config.watchfaceColor,
          braceletMaterial: config.braceletMaterial,
          braceletType: config.braceletType,
          braceletColor: config.braceletColor,
          handsEnabled: config.handsEnabled,
          handsColor: config.handsColor,
          handsStyle: config.watchfaceText || undefined,
          serialNumber: undefined,
          sessionId,
        },
      });
      const priceResult = await calcPrice.mutateAsync({
        data: {
          watchfaceMaterial: config.watchfaceMaterial,
          braceletMaterial: config.braceletMaterial,
          handsEnabled: config.handsEnabled,
        },
      });
      const order = await createOrder.mutateAsync({
        data: { configId: cfg.id, sessionId, totalStars: priceResult.totalStars },
      });
      setLocation(`/payment/${order.id}`);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (!hasPreset) return null;

  return (
    <div className="min-h-[100dvh] w-full bg-background flex flex-col md:flex-row overflow-hidden">

      {/* Left — Watch Preview */}
      <div className="w-full md:w-[52%] h-[44vh] md:h-screen relative bg-gradient-to-br from-background to-muted/30">
        <Link href="/collections">
          <button className="absolute top-3 left-3 z-10 liquid-button px-3 py-1.5 text-xs font-semibold">← Коллекции</button>
        </Link>

        {webglAvailable ? (
          <WebGLErrorBoundary fallback={
            <div className="w-full h-full flex items-center justify-center p-10">
              <WatchSVG />
            </div>
          }>
            <Watch3DView lastInteractionRef={lastInteractionRef} showWrist={showWrist} />
          </WebGLErrorBoundary>
        ) : (
          <div className="w-full h-full flex items-center justify-center p-10">
            <WatchSVG />
          </div>
        )}

        {/* Wrist toggle overlay button */}
        {webglAvailable && (
          <button
            onClick={() => setShowWrist(v => !v)}
            className="absolute bottom-3 right-3 z-10 liquid-button px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            title="Показать/скрыть запястье"
          >
            <span>{showWrist ? '🙈' : '🖐️'}</span>
            <span>{showWrist ? 'Без запястья' : 'На запястье'}</span>
          </button>
        )}
      </div>

      {/* Right — Configuration Panel */}
      <div className="w-full md:w-[48%] md:h-screen flex flex-col bg-background/80 backdrop-blur-xl border-l border-border/60">

        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-2xl px-4 py-2.5">
            <span className="text-base">🔒</span>
            <div className="min-w-0">
              <p className="text-xs font-black text-primary uppercase tracking-widest leading-none">Коллекционная модель</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Настройте ремешок и застёжку под себя</p>
            </div>
          </div>
        </div>

        {/* Step Panel — Bracelet only */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">

          {/* Bracelet Material */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-3">Материал ремешка</h2>
            <div className="grid grid-cols-2 gap-3">
              {BRACELET_MATERIALS.map(m => (
                <OptionCard
                  key={m.value}
                  selected={config.braceletMaterial === m.value}
                  onClick={() => updateConfig({ braceletMaterial: m.value })}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={cn('text-sm font-bold', config.braceletMaterial === m.value ? 'text-primary' : '')}>{m.label}</p>
                    <span className="text-base leading-none opacity-60">{m.pattern}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
                </OptionCard>
              ))}
            </div>
          </div>

          {/* Closing Mechanism */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-3">Застёжка</h2>
            <div className="grid grid-cols-2 gap-3">
              {BRACELET_TYPES.map(t => (
                <OptionCard
                  key={t.value}
                  selected={config.braceletType === t.value}
                  onClick={() => updateConfig({ braceletType: t.value })}
                >
                  <p className={cn('text-sm font-bold mb-0.5', config.braceletType === t.value ? 'text-primary' : '')}>{t.label}</p>
                  <p className="text-xs text-muted-foreground">{t.desc}</p>
                </OptionCard>
              ))}
            </div>
          </div>

          {/* Strap Color */}
          <div>
            <h2 className="text-xl font-bold tracking-tight mb-3">Цвет ремешка</h2>
            <div className="flex flex-wrap gap-2 items-center">
              {STRAP_COLORS.map(c => (
                <ColorSwatch
                  key={c}
                  color={c}
                  selected={config.braceletColor === c}
                  onClick={() => updateConfig({ braceletColor: c })}
                />
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="liquid-glass rounded-2xl p-4 space-y-2 text-sm">
            {([
              ['Коллекция', config.presetId ? `#${config.presetId}` : '—'],
              ['Корпус', config.watchfaceMaterial === 'metal' ? 'Нержавейка' : 'Пластик'],
              ['Ремешок', BRACELET_MATERIALS.find(m => m.value === config.braceletMaterial)?.label ?? config.braceletMaterial],
              ['Застёжка', BRACELET_TYPES.find(t => t.value === config.braceletType)?.label ?? config.braceletType],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="px-5 pb-6 pt-3 border-t border-border/40 space-y-3">
          {/* Price */}
          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-muted-foreground uppercase tracking-widest">Стоимость</span>
            <span className={cn('text-sm font-bold transition-opacity', priceLoading ? 'opacity-40' : 'opacity-100')}>
              {livePrice !== null ? `${livePrice} ⭐` : priceLoading ? '…' : '—'}
            </span>
          </div>
          {/* Buttons */}
          <div className="flex gap-3">
            <Link href="/collections" className="flex-none">
              <button className="liquid-button h-full px-5 py-3 text-sm font-semibold">← Назад</button>
            </Link>
            <button
              onClick={handleOrder}
              disabled={submitting}
              className="flex-1 py-3 rounded-full text-sm font-bold tracking-widest uppercase bg-primary text-white shadow-lg hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60 transition-all"
            >
              {submitting
                ? 'Оформление...'
                : livePrice !== null
                ? `Оформить — ${livePrice} ⭐`
                : 'Оформить заказ →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
