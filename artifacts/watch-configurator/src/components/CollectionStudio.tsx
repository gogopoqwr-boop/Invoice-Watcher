import React, { useState, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Upload, X, ImageIcon, Save, RefreshCw, Trash2 } from 'lucide-react';
import { WatchCardModel } from './WatchMiniCanvas';
import { cn } from '@/lib/utils';
import { TgStar } from './TgStar';

// ── Helpers ──────────────────────────────────────────────────────────────────

function checkWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || (c as any).getContext('experimental-webgl'));
  } catch { return false; }
}
const WEB_GL_OK = checkWebGL();

async function uploadTexture(file: File, jwt: string): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/admin/upload-texture', {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) throw new Error('Ошибка загрузки');
  const { url } = await res.json();
  return url;
}

// ── Zone uploader ────────────────────────────────────────────────────────────

interface ZoneProps {
  label: string;
  hint: string;
  url: string | null;
  loading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}

function TextureZone({ label, hint, url, loading, onUpload, onClear }: ZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) onUpload(file);
  };

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</label>
      <div
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden',
          drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/20',
          url ? 'border-solid border-primary/30' : '',
        )}
        style={{ height: 96 }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={handleDrop}
        onClick={() => !loading && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }}
        />

        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : url ? (
          <>
            <img src={url} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
              <span className="text-white text-xs font-semibold">Заменить</span>
            </div>
            <button
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500 transition-colors z-10"
              onClick={e => { e.stopPropagation(); onClear(); }}
            >
              <X size={12} />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <Upload size={18} />
            <span className="text-[10px] font-medium text-center px-2">{hint}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 3D Preview ───────────────────────────────────────────────────────────────

function StudioPreview({ config }: { config: any }) {
  if (!WEB_GL_OK) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
        <div className="text-center space-y-2">
          <ImageIcon size={32} className="mx-auto opacity-40" />
          <p>WebGL недоступен</p>
        </div>
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, 9.5], fov: 36 }}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
      dpr={[1, 2]}
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[0, 0, 10]} intensity={2.0} />
      <directionalLight position={[5, 8, 6]} intensity={1.0} castShadow />
      <directionalLight position={[-3, 4, 5]} intensity={0.6} />
      <directionalLight position={[-3, -2, -4]} intensity={0.25} />
      <pointLight position={[-4, 2, 3]} intensity={0.5} color="#6366f1" />
      <hemisphereLight intensity={0.3} />
      <Environment preset="city" />
      <WatchCardModel
        watchfaceGeometry={config.watchfaceGeometry ?? 'circle'}
        watchfaceColor={config.watchfaceColor ?? '#1e293b'}
        braceletColor={config.braceletColor ?? '#0f172a'}
        braceletMaterial={config.braceletMaterial ?? 'metal_solid'}
        handsColor={config.handsColor ?? '#cbd5e1'}
        handsEnabled={config.handsEnabled !== false}
        watchfaceText={config.watchfaceText ?? ''}
        watchfaceTextMode={config.watchfaceTextMode ?? 'center'}
        collectionName={config.collectionName ?? null}
        customWatchfaceUrl={config.customWatchfaceUrl ?? null}
        skinStripeUrl={config.skinStripeUrl ?? null}
        skinFullUrl={config.skinFullUrl ?? null}
      />
    </Canvas>
  );
}

// ── Main Collection Studio ────────────────────────────────────────────────────

interface CollectionStudioProps {
  onSaved: () => void;
}

const GEOMETRY_OPTIONS = ['circle', 'square', 'drawn'];
const MATERIAL_OPTIONS = ['metal', 'plastic'];
const BRACELET_OPTIONS = ['metal_solid', 'metal_segmented', 'plastic_solid', 'plastic_segmented', 'leather', 'resin', 'cotton_fabric'];
const TEXT_MODE_OPTIONS = ['center', 'circular'];
const BOX_OPTIONS = ['standard', 'premium', 'collector'];

const GEOMETRY_LABELS: Record<string, string> = { circle: 'Круглый', square: 'Квадратный', drawn: 'Нестандартный' };
const MATERIAL_LABELS: Record<string, string> = { metal: 'Металл', plastic: 'Пластик' };
const BRACELET_LABELS: Record<string, string> = {
  metal_solid: 'Металл сплошной', metal_segmented: 'Металл сегм.',
  plastic_solid: 'Пластик сплошной', plastic_segmented: 'Пластик сегм.',
  leather: 'Кожа', resin: 'Смола', cotton_fabric: 'Ткань NATO',
};
const BOX_LABELS: Record<string, string> = { standard: 'Стандарт', premium: 'Премиум', collector: 'Коллекционная' };
const TEXT_MODE_LABELS: Record<string, string> = { center: 'По центру', circular: 'По кругу' };

const DEFAULT_CONFIG = {
  name: '',
  collectionName: '',
  description: '',
  priceStars: 15,
  maxQuantity: 1000,
  watchfaceGeometry: 'circle',
  watchfaceMaterial: 'metal',
  watchfaceColor: '#1e293b',
  braceletMaterial: 'metal_solid',
  braceletColor: '#0f172a',
  handsEnabled: true,
  handsColor: '#cbd5e1',
  boxType: 'standard',
  watchfaceText: '',
  watchfaceTextMode: 'center',
  customWatchfaceUrl: null as string | null,
  skinStripeUrl: null as string | null,
  skinFullUrl: null as string | null,
};

type Config = typeof DEFAULT_CONFIG;

export function CollectionStudio({ onSaved }: CollectionStudioProps) {
  const [config, setConfig] = useState<Config>({ ...DEFAULT_CONFIG });
  const [uploadingZone, setUploadingZone] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const set = useCallback(<K extends keyof Config>(key: K, val: Config[K]) => {
    setConfig(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleUpload = useCallback(async (zone: keyof Config, file: File) => {
    setUploadingZone(zone);
    try {
      const jwt = localStorage.getItem('jwt') ?? '';
      const url = await uploadTexture(file, jwt);
      setConfig(prev => ({ ...prev, [zone]: url }));
    } catch (e: any) {
      setMsg('Ошибка загрузки файла');
    } finally {
      setUploadingZone(null);
    }
  }, []);

  const handleSave = async () => {
    if (!config.name.trim()) { setMsg('Введите название'); return; }
    setSaving(true);
    setMsg('');
    try {
      const jwt = localStorage.getItem('jwt') ?? '';
      const body = {
        ...config,
        priceStars: Number(config.priceStars),
        maxQuantity: Number(config.maxQuantity),
        collectionName: config.collectionName || null,
        description: config.description || null,
        watchfaceText: config.watchfaceText || null,
      };
      const res = await fetch('/api/admin/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Ошибка сохранения');
      setMsg('✓ Пресет сохранён!');
      setConfig({ ...DEFAULT_CONFIG });
      onSaved();
    } catch (e: any) {
      setMsg(e.message ?? 'Ошибка');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 max-w-5xl">

      {/* ── Left: controls ── */}
      <div className="flex-1 space-y-4 max-w-sm">

        {/* Texture zones */}
        <div className="liquid-glass rounded-3xl p-5 space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Текстуры</p>
          <TextureZone
            label="Циферблат"
            hint="Изображение для циферблата"
            url={config.customWatchfaceUrl}
            loading={uploadingZone === 'customWatchfaceUrl'}
            onUpload={f => handleUpload('customWatchfaceUrl', f)}
            onClear={() => set('customWatchfaceUrl', null)}
          />
          <TextureZone
            label="Ремешок"
            hint="Паттерн или скин ремешка"
            url={config.skinStripeUrl}
            loading={uploadingZone === 'skinStripeUrl'}
            onUpload={f => handleUpload('skinStripeUrl', f)}
            onClear={() => set('skinStripeUrl', null)}
          />
          <TextureZone
            label="Корпус"
            hint="Текстура корпуса часов"
            url={config.skinFullUrl}
            loading={uploadingZone === 'skinFullUrl'}
            onUpload={f => handleUpload('skinFullUrl', f)}
            onClear={() => set('skinFullUrl', null)}
          />
        </div>

        {/* Identity */}
        <div className="liquid-glass rounded-3xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Название и коллекция</p>
          {[
            { key: 'name', label: 'Название *', ph: 'Midnight Steel' },
            { key: 'collectionName', label: 'Коллекция', ph: 'bipolar' },
            { key: 'description', label: 'Описание', ph: 'Брутальная нержавейка…' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
              <input
                value={(config as any)[f.key] ?? ''}
                placeholder={f.ph}
                onChange={e => set(f.key as keyof Config, e.target.value as any)}
                className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ))}
        </div>

        {/* Colors */}
        <div className="liquid-glass rounded-3xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Цвета</p>
          {[
            { key: 'watchfaceColor', label: 'Циферблат / корпус' },
            { key: 'braceletColor', label: 'Ремешок' },
            { key: 'handsColor', label: 'Стрелки' },
          ].map(f => (
            <div key={f.key}>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{f.label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={(config as any)[f.key] ?? '#000000'}
                  onChange={e => set(f.key as keyof Config, e.target.value as any)}
                  className="w-10 h-9 rounded-lg border border-border cursor-pointer"
                />
                <input
                  value={(config as any)[f.key] ?? ''}
                  onChange={e => set(f.key as keyof Config, e.target.value as any)}
                  className="flex-1 rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Shape & material */}
        <div className="liquid-glass rounded-3xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Форма и материал</p>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Форма</label>
            <div className="flex gap-1.5 flex-wrap">
              {GEOMETRY_OPTIONS.map(g => (
                <button key={g} onClick={() => set('watchfaceGeometry', g as any)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    config.watchfaceGeometry === g
                      ? 'bg-primary text-white border-primary'
                      : 'border-border bg-background/40 hover:border-primary/50 text-foreground')}>
                  {GEOMETRY_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Материал корпуса</label>
            <div className="flex gap-1.5">
              {MATERIAL_OPTIONS.map(m => (
                <button key={m} onClick={() => set('watchfaceMaterial', m as any)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    config.watchfaceMaterial === m
                      ? 'bg-primary text-white border-primary'
                      : 'border-border bg-background/40 hover:border-primary/50 text-foreground')}>
                  {MATERIAL_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Ремешок</label>
            <select
              value={config.braceletMaterial}
              onChange={e => set('braceletMaterial', e.target.value as any)}
              className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {BRACELET_OPTIONS.map(b => <option key={b} value={b}>{BRACELET_LABELS[b]}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="studio-hands" checked={config.handsEnabled}
              onChange={e => set('handsEnabled', e.target.checked)}
              className="w-4 h-4 rounded" />
            <label htmlFor="studio-hands" className="text-sm text-foreground cursor-pointer">Стрелки включены</label>
          </div>
        </div>

        {/* Face text */}
        <div className="liquid-glass rounded-3xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Текст циферблата</p>
          <input
            value={config.watchfaceText ?? ''}
            placeholder='DEADLINE или EYE:spider'
            onChange={e => set('watchfaceText', e.target.value as any)}
            className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Расположение</label>
            <div className="flex gap-1.5">
              {TEXT_MODE_OPTIONS.map(m => (
                <button key={m} onClick={() => set('watchfaceTextMode', m as any)}
                  className={cn('px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                    config.watchfaceTextMode === m
                      ? 'bg-primary text-white border-primary'
                      : 'border-border bg-background/40 hover:border-primary/50 text-foreground')}>
                  {TEXT_MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="liquid-glass rounded-3xl p-5 space-y-3">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Цена и лимит</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Цена</label>
              <div className="flex items-center gap-1.5">
                <input type="number" min={1} value={config.priceStars}
                  onChange={e => set('priceStars', Number(e.target.value) as any)}
                  className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono font-bold" />
                <TgStar size={14} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Макс. кол-во</label>
              <input type="number" min={1} value={config.maxQuantity}
                onChange={e => set('maxQuantity', Number(e.target.value) as any)}
                className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Упаковка</label>
            <select value={config.boxType} onChange={e => set('boxType', e.target.value as any)}
              className="w-full rounded-xl px-3 py-2 text-sm border border-border bg-background/60 focus:outline-none focus:ring-2 focus:ring-primary/30">
              {BOX_OPTIONS.map(b => <option key={b} value={b}>{BOX_LABELS[b]}</option>)}
            </select>
          </div>
        </div>

        {/* Save */}
        {msg && (
          <p className={cn('text-sm font-semibold px-1', msg.startsWith('✓') ? 'text-emerald-600' : 'text-red-500')}>{msg}</p>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !config.name.trim()}
          className="w-full py-3 bg-primary text-white rounded-2xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          <Save size={16} />{saving ? '…' : 'Сохранить в коллекцию'}
        </button>

      </div>

      {/* ── Right: live 3D preview ── */}
      <div className="lg:sticky lg:top-24 self-start w-full lg:w-80">
        <div className="liquid-glass rounded-3xl overflow-hidden" style={{ height: 420 }}>
          <div className="relative w-full h-full">
            <StudioPreview config={config} />
            <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
              <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.35)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}>
                Предпросмотр • обновляется мгновенно
              </span>
            </div>
          </div>
        </div>
        {/* Quick config summary */}
        <div className="mt-3 liquid-glass rounded-2xl p-4 space-y-1">
          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Итог</p>
          {config.name && <p className="text-sm font-bold">{config.name}</p>}
          {config.collectionName && <p className="text-xs text-muted-foreground">Коллекция: {config.collectionName}</p>}
          <p className="text-xs text-muted-foreground">{GEOMETRY_LABELS[config.watchfaceGeometry]} · {BRACELET_LABELS[config.braceletMaterial]}</p>
          <div className="flex items-center gap-1 pt-1">
            <span className="text-sm font-bold">{config.priceStars}</span>
            <TgStar size={12} />
          </div>
          {(config.customWatchfaceUrl || config.skinStripeUrl || config.skinFullUrl) && (
            <div className="flex gap-1 flex-wrap pt-1">
              {config.customWatchfaceUrl && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">Циферблат ✓</span>}
              {config.skinStripeUrl && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">Ремешок ✓</span>}
              {config.skinFullUrl && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-semibold">Корпус ✓</span>}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
