'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar3D, AVATAR_3D_PREVIEW_COLORS } from '@/components/Avatar3D';
import {
  type Avatar3DConfig,
  type AccessoryStyle,
  type AccessoryUnlock,
  type HairStyle,
  type ShirtStyle,
  type PantsStyle,
  type ShoeStyle,
  SKIN_TONES,
  HAIR_OPTIONS,
  SHIRT_OPTIONS,
  PANTS_OPTIONS,
  SHOE_OPTIONS,
  ACCESSORY_OPTIONS,
  ACCESSORY_DEFAULTS,
} from '@/lib/avatar3d-config';
import { LEVELS_IN_ORDER } from '@/lib/levels';

const COLOR_PRESETS = [
  '#1F2937', '#374151', '#6B7280', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#3B82F6',
  '#8B5CF6', '#EC4899', '#FFFFFF', '#000000',
];

// Merge AVATAR_3D_PREVIEW_COLORS with COLOR_PRESETS (deduplicated, preview colors first)
const ALL_COLOR_PRESETS = [
  ...AVATAR_3D_PREVIEW_COLORS,
  ...COLOR_PRESETS.filter(c => !AVATAR_3D_PREVIEW_COLORS.includes(c)),
].slice(0, 16);

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 items-center mt-1">
      {ALL_COLOR_PRESETS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          className={cn(
            'w-6 h-6 rounded-full border-2 transition-transform hover:scale-110',
            value === color
              ? 'border-white ring-2 ring-primary scale-110'
              : 'border-transparent'
          )}
          style={{ backgroundColor: color }}
          title={color}
          aria-label={color}
        />
      ))}
      <label className="cursor-pointer" title="Custom color">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-6 h-6 rounded-full border-2 border-transparent cursor-pointer bg-transparent"
          aria-label="Custom color picker"
        />
      </label>
    </div>
  );
}

function levelToIndex(level?: string): number {
  if (!level) return 0;
  const idx = LEVELS_IN_ORDER.indexOf(level as never);
  return idx >= 0 ? idx : 0;
}

function isAccessoryUnlocked(
  style: AccessoryStyle,
  unlocks: Record<AccessoryStyle, AccessoryUnlock> | undefined,
  userLevel: string | undefined,
  userBalance: number | undefined
): { locked: boolean; reason: string } {
  const cfg = unlocks?.[style] ?? ACCESSORY_DEFAULTS[style];
  if (!cfg || cfg.type === 'free') return { locked: false, reason: '' };
  if (cfg.type === 'level') {
    const required = cfg.requiredLevel ?? 'spark';
    const reqIdx = levelToIndex(required);
    const userIdx = levelToIndex(userLevel);
    if (userIdx < reqIdx) {
      return { locked: true, reason: `Requires ${required} level` };
    }
    return { locked: false, reason: '' };
  }
  if (cfg.type === 'coins') {
    const cost = cfg.ccCost ?? 0;
    const balance = userBalance ?? 0;
    if (balance < cost) {
      return { locked: true, reason: `${cost} CC required` };
    }
    return { locked: false, reason: '' };
  }
  return { locked: false, reason: '' };
}

export function Avatar3DBuilder({
  config,
  onChange,
  unlocks,
  userLevel,
  userBalance,
}: {
  config: Avatar3DConfig;
  onChange: (c: Avatar3DConfig) => void;
  unlocks?: Record<AccessoryStyle, AccessoryUnlock>;
  userLevel?: string;
  userBalance?: number;
}) {
  const set = <K extends keyof Avatar3DConfig>(key: K, value: Avatar3DConfig[K]) => {
    onChange({ ...config, [key]: value });
  };

  const currentHairOption = HAIR_OPTIONS.find((o) => o.value === config.hairStyle);
  const isHat = currentHairOption?.isHat ?? false;
  const currentShirtOption = SHIRT_OPTIONS.find((o) => o.value === config.shirtStyle);
  const isShirtColorable = currentShirtOption?.colorable ?? true;

  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">

      {/* ── Left: Preview ── */}
      <div className="flex-shrink-0 lg:w-64">
        <div className="sticky top-4">
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-white/10 p-6 flex flex-col items-center gap-3 shadow-xl">
            <Avatar3D config={config} size={240} showShadow />
            <p className="text-xs text-muted-foreground font-medium">Preview</p>
          </div>
        </div>
      </div>

      {/* ── Right: Controls ── */}
      <div className="flex-1 space-y-6 overflow-y-auto max-h-[80vh] pr-1">

        {/* ── Skin Tone ── */}
        <div className="space-y-3">
          <SectionHeader>Skin Tone</SectionHeader>
          <div className="flex gap-3 flex-wrap">
            {(Object.entries(SKIN_TONES) as [keyof typeof SKIN_TONES, typeof SKIN_TONES[keyof typeof SKIN_TONES]][]).map(
              ([key, tone]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => set('skinTone', key)}
                  title={tone.label}
                  aria-label={tone.label}
                  className={cn(
                    'w-9 h-9 rounded-full border-4 transition-transform hover:scale-110',
                    config.skinTone === key
                      ? 'border-primary ring-2 ring-primary/50 scale-110'
                      : 'border-transparent hover:border-white/30'
                  )}
                  style={{ backgroundColor: tone.swatch }}
                />
              )
            )}
          </div>
        </div>

        {/* ── Hair ── */}
        <div className="space-y-3">
          <SectionHeader>Hair &amp; Headwear</SectionHeader>
          <div className="grid grid-cols-5 gap-1.5">
            {HAIR_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('hairStyle', opt.value as HairStyle)}
                className={cn(
                  'flex flex-col items-center gap-0.5 p-1.5 rounded-lg border text-center transition-all text-xs',
                  config.hairStyle === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card text-muted-foreground'
                )}
              >
                <span className="text-base leading-none">{opt.emoji}</span>
                <span className="leading-tight line-clamp-1">{opt.label}</span>
              </button>
            ))}
          </div>
          {!isHat && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Hair Color</p>
              <ColorPicker value={config.hairColor} onChange={(c) => set('hairColor', c)} />
            </div>
          )}
        </div>

        {/* ── Shirt ── */}
        <div className="space-y-3">
          <SectionHeader>Shirt</SectionHeader>
          <div className="grid grid-cols-3 gap-1.5">
            {SHIRT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('shirtStyle', opt.value as ShirtStyle)}
                className={cn(
                  'flex items-center gap-1.5 p-2 rounded-lg border transition-all text-xs',
                  config.shirtStyle === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card text-muted-foreground'
                )}
              >
                <span className="text-base leading-none flex-shrink-0">{opt.emoji}</span>
                <span className="leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
          {isShirtColorable && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Shirt Color</p>
              <ColorPicker value={config.shirtColor} onChange={(c) => set('shirtColor', c)} />
            </div>
          )}
        </div>

        {/* ── Pants ── */}
        <div className="space-y-3">
          <SectionHeader>Pants</SectionHeader>
          <div className="grid grid-cols-3 gap-1.5">
            {PANTS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('pantsStyle', opt.value as PantsStyle)}
                className={cn(
                  'flex items-center gap-1.5 p-2 rounded-lg border transition-all text-xs',
                  config.pantsStyle === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card text-muted-foreground'
                )}
              >
                <span className="text-base leading-none flex-shrink-0">{opt.emoji}</span>
                <span className="leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Pants Color</p>
            <ColorPicker value={config.pantsColor} onChange={(c) => set('pantsColor', c)} />
          </div>
        </div>

        {/* ── Shoes ── */}
        <div className="space-y-3">
          <SectionHeader>Shoes</SectionHeader>
          <div className="grid grid-cols-2 gap-1.5">
            {SHOE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set('shoeStyle', opt.value as ShoeStyle)}
                className={cn(
                  'flex items-center gap-1.5 p-2 rounded-lg border transition-all text-xs',
                  config.shoeStyle === opt.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card text-muted-foreground'
                )}
              >
                <span className="text-base leading-none flex-shrink-0">{opt.emoji}</span>
                <span className="leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Shoe Color</p>
            <ColorPicker value={config.shoeColor} onChange={(c) => set('shoeColor', c)} />
          </div>
        </div>

        {/* ── Accessories ── */}
        <div className="space-y-3">
          <SectionHeader>Accessories</SectionHeader>
          <div className="grid grid-cols-2 gap-1.5">
            {ACCESSORY_OPTIONS.map((opt) => {
              const { locked, reason } = isAccessoryUnlocked(
                opt.value,
                unlocks,
                userLevel,
                userBalance
              );
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    if (!locked) set('accessory', opt.value);
                  }}
                  disabled={locked}
                  className={cn(
                    'relative flex items-center gap-1.5 p-2 rounded-lg border transition-all text-xs',
                    config.accessory === opt.value && !locked
                      ? 'border-primary bg-primary/10 text-primary'
                      : locked
                      ? 'border-border/30 bg-card/20 text-muted-foreground/40 cursor-not-allowed'
                      : 'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card text-muted-foreground'
                  )}
                >
                  <span className="text-base leading-none flex-shrink-0">{opt.emoji}</span>
                  <span className="leading-tight flex-1 text-left">{opt.label}</span>
                  {locked && (
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 h-4 ml-auto border-amber-600/60 text-amber-500 shrink-0"
                    >
                      {reason.includes('level') ? '🔒 Lvl' : '🔒 CC'}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
          {(() => {
            const lockedItems = ACCESSORY_OPTIONS.filter((opt) => {
              const { locked } = isAccessoryUnlocked(opt.value, unlocks, userLevel, userBalance);
              return locked;
            });
            if (lockedItems.length === 0) return null;
            return (
              <div className="rounded-lg bg-amber-950/20 border border-amber-900/30 p-2 space-y-1">
                <p className="text-[10px] font-semibold text-amber-500/80 uppercase tracking-widest">
                  Locked Accessories
                </p>
                {lockedItems.map((opt) => {
                  const { reason } = isAccessoryUnlocked(opt.value, unlocks, userLevel, userBalance);
                  return (
                    <div key={opt.value} className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                      <span>{opt.emoji}</span>
                      <span>{opt.label}</span>
                      <span className="ml-auto text-amber-600/70">{reason}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
