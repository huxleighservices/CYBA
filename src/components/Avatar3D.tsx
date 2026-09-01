'use client';

import { useId } from 'react';
import type { Avatar3DConfig } from '@/lib/avatar3d-config';
import { SKIN_TONES } from '@/lib/avatar3d-config';

export const AVATAR_3D_PREVIEW_COLORS = [
  '#1F2937', '#374151', '#6B7280', '#EF4444',
  '#F97316', '#EAB308', '#22C55E', '#3B82F6',
  '#8B5CF6', '#EC4899', '#FFFFFF', '#000000',
];

export function Avatar3D({
  config,
  size = 180,
  showShadow = false,
}: {
  config: Avatar3DConfig;
  size?: number;
  showShadow?: boolean;
}) {
  const rawId = useId();
  const uid = rawId.replace(/:/g, '');

  const skin = SKIN_TONES[config.skinTone] ?? SKIN_TONES['medium-light'];
  const height = Math.round(size * (420 / 200));

  // ── gradient IDs ──────────────────────────────────────────────
  const faceGradId    = `fg-${uid}`;
  const clothGradId   = `cl-${uid}`;
  const shoeGradId    = `sh-${uid}`;
  const legGradId     = `lg-${uid}`;
  const shadowId      = `sd-${uid}`;
  const wingFlipLId   = `wfl-${uid}`;
  const wingFlipRId   = `wfr-${uid}`;

  const isHat = ['cap', 'devil-horns', 'beanie'].includes(config.hairStyle);

  return (
    <svg
      viewBox="0 0 200 420"
      width={size}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', overflow: 'visible' }}
    >
      <defs>
        {/* ── CSS animations ── */}
        <style>{`
          @keyframes av-flap  { 0%,100%{transform:scaleX(1)} 50%{transform:scaleX(0.8)} }
          @keyframes av-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
          @keyframes av-fire  { 0%,100%{opacity:1;transform:scaleY(1)} 50%{opacity:0.6;transform:scaleY(1.3)} }
          @keyframes av-note  { 0%{opacity:0;transform:translate(0,0)} 60%{opacity:1} 100%{opacity:0;transform:translate(5px,-25px)} }
          @keyframes av-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }
          .av-wing-l { transform-origin: 80px 180px; animation: av-flap 1.6s ease-in-out infinite; }
          .av-wing-r { transform-origin: 120px 180px; animation: av-flap 1.6s ease-in-out infinite; animation-delay: 0.1s; }
          .av-float  { animation: av-float 2s ease-in-out infinite; }
          .av-fire   { transform-origin: 30px 360px; animation: av-fire 0.7s ease-in-out infinite; }
          .av-note1  { animation: av-note 2s ease-in-out infinite; }
          .av-note2  { animation: av-note 2s ease-in-out infinite; animation-delay: 0.8s; }
          .av-dragon { animation: av-float 2.4s ease-in-out infinite; animation-delay: 0.3s; }
          .av-pulse  { transform-origin: 155px 340px; animation: av-pulse 1.8s ease-in-out infinite; }
        `}</style>

        {/* ── Face radial gradient (3D look) ── */}
        <radialGradient id={faceGradId} cx="38%" cy="35%" r="60%" fx="38%" fy="35%">
          <stop offset="0%"   stopColor={skin.highlight} />
          <stop offset="60%"  stopColor={skin.base} />
          <stop offset="100%" stopColor={skin.shadow} />
        </radialGradient>

        {/* ── Clothing overlay gradient (3D shading) ── */}
        <linearGradient id={clothGradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="50%"  stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.22" />
        </linearGradient>

        {/* ── Shoe shading gradient ── */}
        <linearGradient id={shoeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.3" />
        </linearGradient>

        {/* ── Leg shading gradient ── */}
        <linearGradient id={legGradId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#000000" stopOpacity="0.12" />
          <stop offset="40%"  stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>

        {/* ── Drop shadow filter ── */}
        <filter id={shadowId} x="-20%" y="-5%" width="140%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.35" />
        </filter>

        {/* ── Wing flip transforms ── */}
        <g id={wingFlipLId} transform="scale(-1,1) translate(-200,0)" />
        <g id={wingFlipRId} />
      </defs>

      <g filter={showShadow ? `url(#${shadowId})` : undefined}>

        {/* ════════════════════════════════════════
            LAYER 1 — Back accessories (wings)
        ════════════════════════════════════════ */}
        {config.accessory === 'angel-wings' && (
          <g>
            {/* Left wing */}
            <g className="av-wing-l">
              <ellipse cx="55" cy="175" rx="42" ry="22" fill="#F8F4E8" transform="rotate(-30,55,175)" />
              <ellipse cx="42" cy="192" rx="32" ry="18" fill="#F0ECD8" transform="rotate(-40,42,192)" />
              <ellipse cx="35" cy="210" rx="26" ry="14" fill="#F8F4E8" transform="rotate(-50,35,210)" />
              {/* Feather lines */}
              <line x1="58" y1="165" x2="18" y2="190" stroke="#D4CEBC" strokeWidth="0.8" />
              <line x1="52" y1="175" x2="14" y2="200" stroke="#D4CEBC" strokeWidth="0.8" />
              <line x1="48" y1="186" x2="12" y2="210" stroke="#D4CEBC" strokeWidth="0.8" />
            </g>
            {/* Right wing */}
            <g className="av-wing-r">
              <ellipse cx="145" cy="175" rx="42" ry="22" fill="#F8F4E8" transform="rotate(30,145,175)" />
              <ellipse cx="158" cy="192" rx="32" ry="18" fill="#F0ECD8" transform="rotate(40,158,192)" />
              <ellipse cx="165" cy="210" rx="26" ry="14" fill="#F8F4E8" transform="rotate(50,165,210)" />
              <line x1="142" y1="165" x2="182" y2="190" stroke="#D4CEBC" strokeWidth="0.8" />
              <line x1="148" y1="175" x2="186" y2="200" stroke="#D4CEBC" strokeWidth="0.8" />
              <line x1="152" y1="186" x2="188" y2="210" stroke="#D4CEBC" strokeWidth="0.8" />
            </g>
          </g>
        )}
        {config.accessory === 'devil-wings' && (
          <g>
            {/* Left bat-wing */}
            <g className="av-wing-l">
              <path d="M72,168 Q40,140 14,155 Q28,172 45,178 Q30,185 18,200 Q38,195 55,185 Q60,195 65,205 Z" fill="#CC2200" />
              <path d="M72,168 Q40,140 14,155 Q28,172 45,178 Q30,185 18,200 Q38,195 55,185 Q60,195 65,205 Z" fill="none" stroke="#990000" strokeWidth="1" />
              {/* Wing membrane lines */}
              <line x1="65" y1="170" x2="20" y2="158" stroke="#991100" strokeWidth="0.7" />
              <line x1="62" y1="178" x2="22" y2="182" stroke="#991100" strokeWidth="0.7" />
              <line x1="60" y1="188" x2="22" y2="196" stroke="#991100" strokeWidth="0.7" />
            </g>
            {/* Right bat-wing */}
            <g className="av-wing-r">
              <path d="M128,168 Q160,140 186,155 Q172,172 155,178 Q170,185 182,200 Q162,195 145,185 Q140,195 135,205 Z" fill="#CC2200" />
              <path d="M128,168 Q160,140 186,155 Q172,172 155,178 Q170,185 182,200 Q162,195 145,185 Q140,195 135,205 Z" fill="none" stroke="#990000" strokeWidth="1" />
              <line x1="135" y1="170" x2="180" y2="158" stroke="#991100" strokeWidth="0.7" />
              <line x1="138" y1="178" x2="178" y2="182" stroke="#991100" strokeWidth="0.7" />
              <line x1="140" y1="188" x2="178" y2="196" stroke="#991100" strokeWidth="0.7" />
            </g>
          </g>
        )}

        {/* ════════════════════════════════════════
            LAYER 2 — Legs / Pants
        ════════════════════════════════════════ */}
        {renderPants(config, legGradId)}

        {/* ════════════════════════════════════════
            LAYER 3 — Shoes
        ════════════════════════════════════════ */}
        {renderShoes(config, shoeGradId)}

        {/* ════════════════════════════════════════
            LAYER 4 — Torso / Shirt body
        ════════════════════════════════════════ */}
        {renderShirtBody(config, clothGradId, skin)}

        {/* ════════════════════════════════════════
            LAYER 5 — Arms
        ════════════════════════════════════════ */}
        {renderArms(config, clothGradId, skin)}

        {/* ════════════════════════════════════════
            LAYER 6 — Neck
        ════════════════════════════════════════ */}
        <rect x="90" y="121" width="20" height="22" rx="4" fill={`url(#${faceGradId})`} />
        <rect x="90" y="121" width="20" height="22" rx="4" fill="none" stroke={skin.shadow} strokeWidth="0.5" />

        {/* ════════════════════════════════════════
            LAYER 7 — Head
        ════════════════════════════════════════ */}
        {/* Ears */}
        <ellipse cx="50" cy="75" rx="12" ry="12" fill={`url(#${faceGradId})`} />
        <ellipse cx="50" cy="75" rx="12" ry="12" fill="none" stroke={skin.shadow} strokeWidth="0.7" />
        <ellipse cx="150" cy="75" rx="12" ry="12" fill={`url(#${faceGradId})`} />
        <ellipse cx="150" cy="75" rx="12" ry="12" fill="none" stroke={skin.shadow} strokeWidth="0.7" />
        {/* Inner ear detail */}
        <ellipse cx="50" cy="75" rx="6" ry="7" fill={skin.shadow} fillOpacity="0.25" />
        <ellipse cx="150" cy="75" rx="6" ry="7" fill={skin.shadow} fillOpacity="0.25" />
        {/* Head shape */}
        <ellipse cx="100" cy="72" rx="50" ry="50" fill={`url(#${faceGradId})`} />
        <ellipse cx="100" cy="72" rx="50" ry="50" fill="none" stroke={skin.shadow} strokeWidth="0.8" />

        {/* ════════════════════════════════════════
            LAYER 8 — Face features
        ════════════════════════════════════════ */}
        {/* Eyebrows */}
        <path d="M76,54 Q83,50 90,54" fill="none" stroke={config.hairColor} strokeWidth="2.5" strokeLinecap="round" />
        <path d="M110,54 Q117,50 124,54" fill="none" stroke={config.hairColor} strokeWidth="2.5" strokeLinecap="round" />
        {/* Eyes */}
        <ellipse cx="83" cy="66" rx="8" ry="9" fill="#FFFFFF" />
        <ellipse cx="117" cy="66" rx="8" ry="9" fill="#FFFFFF" />
        <ellipse cx="84" cy="67" rx="5" ry="6" fill="#3B2505" />
        <ellipse cx="118" cy="67" rx="5" ry="6" fill="#3B2505" />
        {/* Iris */}
        <ellipse cx="84" cy="67" rx="3.5" ry="4.5" fill="#5B3A10" />
        <ellipse cx="118" cy="67" rx="3.5" ry="4.5" fill="#5B3A10" />
        {/* Pupils */}
        <ellipse cx="84.5" cy="67.5" rx="2" ry="2.5" fill="#111111" />
        <ellipse cx="118.5" cy="67.5" rx="2" ry="2.5" fill="#111111" />
        {/* Eye shine */}
        <circle cx="87" cy="64" r="1.5" fill="#FFFFFF" fillOpacity="0.9" />
        <circle cx="121" cy="64" r="1.5" fill="#FFFFFF" fillOpacity="0.9" />
        {/* Nose */}
        <circle cx="100" cy="79" r="3" fill={skin.shadow} fillOpacity="0.45" />
        <path d="M94,79 Q100,85 106,79" fill="none" stroke={skin.shadow} strokeWidth="1.2" strokeLinecap="round" />
        {/* Smile */}
        <path d="M85,90 Q100,103 115,90" fill="none" stroke={skin.shadow} strokeWidth="2" strokeLinecap="round" />
        {/* Blush cheeks */}
        <ellipse cx="70" cy="82" rx="9" ry="5" fill="#FF9999" fillOpacity="0.35" />
        <ellipse cx="130" cy="82" rx="9" ry="5" fill="#FF9999" fillOpacity="0.35" />

        {/* ════════════════════════════════════════
            LAYER 9 — Hair / Hat
        ════════════════════════════════════════ */}
        {renderHair(config, isHat)}

        {/* ════════════════════════════════════════
            LAYER 10 — Front accessories
        ════════════════════════════════════════ */}
        {config.accessory === 'skateboard' && (
          <g>
            {/* Deck */}
            <rect x="30" y="378" width="140" height="18" rx="9" fill="#C85A10" />
            <rect x="30" y="378" width="140" height="18" rx="9" fill="none" stroke="#8B3A08" strokeWidth="1" />
            {/* Grip tape lines */}
            <line x1="40" y1="380" x2="160" y2="380" stroke="#7A3008" strokeWidth="0.5" strokeDasharray="3,3" />
            <line x1="40" y1="384" x2="160" y2="384" stroke="#7A3008" strokeWidth="0.5" strokeDasharray="3,3" />
            <line x1="40" y1="388" x2="160" y2="388" stroke="#7A3008" strokeWidth="0.5" strokeDasharray="3,3" />
            {/* Wheels */}
            <circle cx="55"  cy="398" r="8" fill="#333333" />
            <circle cx="55"  cy="398" r="4" fill="#555555" />
            <circle cx="145" cy="398" r="8" fill="#333333" />
            <circle cx="145" cy="398" r="4" fill="#555555" />
            <circle cx="85"  cy="398" r="6" fill="#333333" />
            <circle cx="85"  cy="398" r="3" fill="#555555" />
            <circle cx="115" cy="398" r="6" fill="#333333" />
            <circle cx="115" cy="398" r="3" fill="#555555" />
            {/* Trucks */}
            <rect x="48" y="394" width="14" height="4" rx="2" fill="#888888" />
            <rect x="138" y="394" width="14" height="4" rx="2" fill="#888888" />
          </g>
        )}
        {config.accessory === 'boombox' && (
          <g>
            {/* Boombox body held at left arm */}
            <rect x="8" y="182" width="54" height="36" rx="6" fill="#1A1A2E" />
            <rect x="8" y="182" width="54" height="36" rx="6" fill="none" stroke="#333355" strokeWidth="1.5" />
            {/* Speakers */}
            <circle cx="22" cy="200" r="9"  fill="#0D0D20" stroke="#333355" strokeWidth="1" />
            <circle cx="22" cy="200" r="5"  fill="#1A1A3E" />
            <circle cx="22" cy="200" r="2"  fill="#333355" />
            <circle cx="48" cy="200" r="9"  fill="#0D0D20" stroke="#333355" strokeWidth="1" />
            <circle cx="48" cy="200" r="5"  fill="#1A1A3E" />
            <circle cx="48" cy="200" r="2"  fill="#333355" />
            {/* Center display */}
            <rect x="29" y="188" width="12" height="8" rx="2" fill="#00FF41" fillOpacity="0.8" />
            {/* Antenna */}
            <line x1="18" y1="182" x2="12" y2="168" stroke="#555577" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="167" r="2" fill="#FF5533" />
            {/* Handle */}
            <path d="M18,182 Q35,175 52,182" fill="none" stroke="#333355" strokeWidth="2" />
            {/* Music notes floating */}
            <text className="av-note1" x="64" y="180" fontSize="10" fill="#FFD700">♪</text>
            <text className="av-note2" x="68" y="165" fontSize="8"  fill="#FF69B4">♫</text>
          </g>
        )}
        {config.accessory === 'gold-chain' && (
          <g>
            {/* Gold chain around neck/chest */}
            <path d="M88,135 Q100,132 112,135 Q125,148 128,162 Q120,172 100,174 Q80,172 72,162 Q75,148 88,135 Z"
              fill="none" stroke="#FFD700" strokeWidth="3" strokeLinecap="round" />
            {/* Chain links */}
            {[...Array(12)].map((_, i) => {
              const t = i / 11;
              const angle = Math.PI * 0.2 + t * Math.PI * 0.6;
              const cx2 = 100 + Math.cos(angle) * 28 * (t < 0.5 ? (1 + t * 0.5) : (1 + (1 - t) * 0.5));
              const cy2 = 135 + Math.sin(angle) * 22 + t * (1 - t) * 18;
              return (
                <ellipse key={i} cx={cx2} cy={cy2} rx="3" ry="2"
                  fill="none" stroke="#FFD700" strokeWidth="1.5"
                  transform={`rotate(${angle * 57 + 90},${cx2},${cy2})`} />
              );
            })}
            {/* Pendant */}
            <polygon points="100,165 105,175 100,178 95,175" fill="#FFD700" stroke="#B8860B" strokeWidth="1" />
            <circle cx="100" cy="173" r="3" fill="#FFB700" />
          </g>
        )}
        {config.accessory === 'dragon' && (
          <g className="av-dragon">
            {/* Small cute dragon to the right */}
            {/* Body */}
            <ellipse cx="160" cy="330" rx="22" ry="18" fill="#2D8A4E" />
            <ellipse cx="160" cy="330" rx="22" ry="18" fill="none" stroke="#1A5C32" strokeWidth="1" />
            {/* Belly */}
            <ellipse cx="160" cy="333" rx="14" ry="11" fill="#6DCF94" fillOpacity="0.8" />
            {/* Head */}
            <ellipse cx="175" cy="314" rx="16" ry="14" fill="#2D8A4E" />
            <ellipse cx="175" cy="314" rx="16" ry="14" fill="none" stroke="#1A5C32" strokeWidth="1" />
            {/* Snout */}
            <ellipse cx="188" cy="316" rx="8" ry="6" fill="#3A9E5C" />
            {/* Nostrils */}
            <circle cx="186" cy="315" r="1.5" fill="#1A5C32" />
            <circle cx="190" cy="315" r="1.5" fill="#1A5C32" />
            {/* Eyes */}
            <circle cx="178" cy="309" r="4" fill="#FFFFFF" />
            <circle cx="178" cy="309" r="2.5" fill="#FF6B00" />
            <circle cx="178" cy="309" r="1.5" fill="#000000" />
            <circle cx="179" cy="308" r="0.8" fill="#FFFFFF" />
            {/* Horns */}
            <path d="M170,302 Q168,294 172,292 Q174,298 172,302 Z" fill="#1A5C32" />
            <path d="M180,300 Q178,292 182,290 Q184,296 182,300 Z" fill="#1A5C32" />
            {/* Wings */}
            <path d="M145,318 Q132,308 130,295 Q138,300 146,310 Z" fill="#1A5C32" />
            <path d="M145,318 Q132,308 130,295 Q138,300 146,310 Z" fill="none" stroke="#0E3D20" strokeWidth="0.8" />
            {/* Tail */}
            <path d="M140,338 Q126,345 120,358 Q130,355 138,345 Q142,342 145,340 Z" fill="#2D8A4E" />
            {/* Fire breath */}
            <g className="av-fire">
              <path d="M194,313 Q202,308 208,300 Q204,305 210,295 Q205,302 207,295 Q200,305 196,310 Q202,306 199,312 Z"
                fill="#FF6B00" fillOpacity="0.9" />
              <path d="M196,313 Q203,310 210,303 Q207,308 212,299"
                fill="none" stroke="#FFD700" strokeWidth="1.5" strokeLinecap="round" />
            </g>
            {/* Feet */}
            <ellipse cx="150" cy="348" rx="8" ry="5" fill="#2D8A4E" />
            <ellipse cx="170" cy="348" rx="8" ry="5" fill="#2D8A4E" />
            {/* Claws */}
            <path d="M145,350 L143,355 M148,351 L147,356 M151,350 L150,355" stroke="#1A5C32" strokeWidth="1.2" />
            <path d="M165,350 L163,355 M168,351 L167,356 M171,350 L170,355" stroke="#1A5C32" strokeWidth="1.2" />
          </g>
        )}
      </g>
    </svg>
  );
}

// ─── Hair Renderer ──────────────────────────────────────────────────────────
function renderHair(config: Avatar3DConfig, _isHat: boolean) {
  const c = config.hairColor;
  switch (config.hairStyle) {
    case 'short':
      return (
        <g>
          <path d="M50,72 Q50,22 100,22 Q150,22 150,72 Q145,55 135,48 Q120,38 100,36 Q80,38 65,48 Q55,55 50,72 Z"
            fill={c} />
          <path d="M50,72 Q50,22 100,22 Q150,22 150,72 Q145,55 135,48 Q120,38 100,36 Q80,38 65,48 Q55,55 50,72 Z"
            fill="none" stroke={darken(c)} strokeWidth="1" />
        </g>
      );
    case 'medium':
      return (
        <g>
          <path d="M50,72 Q50,22 100,22 Q150,22 150,72 Q145,55 135,48 Q120,38 100,36 Q80,38 65,48 Q55,55 50,72 Z"
            fill={c} />
          {/* Side tufts */}
          <path d="M52,72 Q44,80 46,92 Q50,85 54,80 Z" fill={c} />
          <path d="M148,72 Q156,80 154,92 Q150,85 146,80 Z" fill={c} />
          <path d="M50,72 Q50,22 100,22 Q150,22 150,72 Q145,55 135,48 Q120,38 100,36 Q80,38 65,48 Q55,55 50,72 Z"
            fill="none" stroke={darken(c)} strokeWidth="1" />
        </g>
      );
    case 'long':
      return (
        <g>
          {/* Main cap */}
          <path d="M50,72 Q50,22 100,22 Q150,22 150,72 Q145,55 135,48 Q120,38 100,36 Q80,38 65,48 Q55,55 50,72 Z"
            fill={c} />
          {/* Long side panels */}
          <path d="M52,72 Q44,100 46,140 Q50,170 55,210 Q60,185 62,155 Q64,120 60,90 Z" fill={c} />
          <path d="M148,72 Q156,100 154,140 Q150,170 145,210 Q140,185 138,155 Q136,120 140,90 Z" fill={c} />
          {/* Shine lines */}
          <path d="M80,38 Q78,60 80,80" fill="none" stroke={lighten(c)} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M100,36 Q98,58 100,78" fill="none" stroke={lighten(c)} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'curly':
      return (
        <g>
          <circle cx="100" cy="30" r="16" fill={c} />
          <circle cx="78"  cy="38" r="16" fill={c} />
          <circle cx="122" cy="38" r="16" fill={c} />
          <circle cx="62"  cy="56" r="16" fill={c} />
          <circle cx="138" cy="56" r="16" fill={c} />
          <circle cx="58"  cy="74" r="14" fill={c} />
          <circle cx="142" cy="74" r="14" fill={c} />
          {/* Top center */}
          <circle cx="100" cy="24" r="14" fill={c} />
          {/* Highlights */}
          <circle cx="100" cy="28" r="5" fill={lighten(c)} fillOpacity="0.4" />
          <circle cx="78"  cy="36" r="4" fill={lighten(c)} fillOpacity="0.4" />
          <circle cx="122" cy="36" r="4" fill={lighten(c)} fillOpacity="0.4" />
        </g>
      );
    case 'bun':
      return (
        <g>
          <path d="M50,72 Q50,22 100,22 Q150,22 150,72 Q145,55 135,48 Q120,38 100,36 Q80,38 65,48 Q55,55 50,72 Z"
            fill={c} />
          {/* Bun on top */}
          <circle cx="100" cy="22" r="18" fill={c} />
          <circle cx="100" cy="22" r="18" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Bun highlight */}
          <circle cx="94" cy="16" r="6" fill={lighten(c)} fillOpacity="0.35" />
          {/* Hair tie */}
          <ellipse cx="100" cy="35" rx="12" ry="4" fill={darken(c)} />
        </g>
      );
    case 'afro':
      return (
        <g>
          {/* Large afro puff behind head */}
          <ellipse cx="100" cy="55" rx="62" ry="58" fill={c} />
          {/* Side puffs */}
          <ellipse cx="42"  cy="70" rx="22" ry="26" fill={c} />
          <ellipse cx="158" cy="70" rx="22" ry="26" fill={c} />
          {/* Top puff */}
          <ellipse cx="100" cy="14" rx="38" ry="22" fill={c} />
          {/* Texture dots */}
          {[...Array(18)].map((_, i) => {
            const angle = (i / 18) * Math.PI * 2;
            const r2 = 44 + (i % 3) * 8;
            return (
              <circle key={i}
                cx={100 + Math.cos(angle) * r2}
                cy={55 + Math.sin(angle) * r2 * 0.8}
                r="3" fill={darken(c)} fillOpacity="0.3" />
            );
          })}
          {/* Highlight */}
          <ellipse cx="85" cy="32" rx="18" ry="12" fill={lighten(c)} fillOpacity="0.2" />
        </g>
      );
    case 'cap': {
      const capColor = config.hairColor;
      return (
        <g>
          {/* Cap back half */}
          <path d="M50,72 Q50,30 100,26 Q150,30 150,72 Q130,58 100,55 Q70,58 50,72 Z"
            fill={capColor} />
          {/* Cap crown */}
          <path d="M55,68 Q55,26 100,24 Q145,26 145,68 Q130,55 100,52 Q70,55 55,68 Z"
            fill={capColor} />
          {/* Brim - front facing */}
          <path d="M60,66 Q80,60 100,58 Q120,60 140,66 Q120,75 100,78 Q80,75 60,66 Z"
            fill={darken(capColor)} />
          <path d="M60,66 Q80,60 100,58 Q120,60 140,66 Q150,72 140,68 Q120,70 100,68 Q80,70 60,68 Q50,72 60,66 Z"
            fill={capColor} />
          {/* Brim underside */}
          <path d="M62,67 Q100,78 138,67 Q100,72 62,67 Z" fill={darken(capColor)} fillOpacity="0.4" />
          {/* Center button */}
          <circle cx="100" cy="26" r="4" fill={darken(capColor)} />
          {/* Panel seam lines */}
          <path d="M100,26 Q95,45 93,66" fill="none" stroke={darken(capColor)} strokeWidth="0.8" />
          <path d="M100,26 Q105,45 107,66" fill="none" stroke={darken(capColor)} strokeWidth="0.8" />
        </g>
      );
    }
    case 'devil-horns':
      return (
        <g>
          {/* Short dark hair base */}
          <path d="M52,72 Q52,36 100,28 Q148,36 148,72 Q138,55 100,50 Q62,55 52,72 Z"
            fill={config.hairColor} />
          {/* Left horn */}
          <path d="M68,42 Q58,18 70,8 Q76,18 78,34 Q74,38 68,42 Z" fill="#CC2200" />
          <path d="M68,42 Q58,18 70,8 Q76,18 78,34 Q74,38 68,42 Z"
            fill="none" stroke="#991100" strokeWidth="1" />
          {/* Right horn */}
          <path d="M132,42 Q142,18 130,8 Q124,18 122,34 Q126,38 132,42 Z" fill="#CC2200" />
          <path d="M132,42 Q142,18 130,8 Q124,18 122,34 Q126,38 132,42 Z"
            fill="none" stroke="#991100" strokeWidth="1" />
          {/* Horn highlights */}
          <path d="M70,10 Q68,16 70,22" fill="none" stroke="#FF4422" strokeWidth="1" strokeLinecap="round" />
          <path d="M130,10 Q132,16 130,22" fill="none" stroke="#FF4422" strokeWidth="1" strokeLinecap="round" />
        </g>
      );
    case 'beanie': {
      const bc = config.hairColor;
      return (
        <g>
          {/* Beanie main body */}
          <path d="M52,74 Q52,28 100,22 Q148,28 148,74 Q130,60 100,58 Q70,60 52,74 Z"
            fill={bc} />
          {/* Ribbed band at bottom */}
          <rect x="50" y="64" width="100" height="14" rx="3" fill={darken(bc)} />
          {/* Knit pattern lines */}
          <line x1="56" y1="66" x2="56" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="63" y1="65" x2="63" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="70" y1="64" x2="70" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="77" y1="64" x2="77" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="84" y1="64" x2="84" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="91" y1="64" x2="91" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="98" y1="64" x2="98" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="105" y1="64" x2="105" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="112" y1="64" x2="112" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="119" y1="64" x2="119" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="126" y1="65" x2="126" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="133" y1="66" x2="133" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          <line x1="140" y1="67" x2="140" y2="78" stroke={lighten(bc)} strokeWidth="1.2" />
          {/* Pom-pom */}
          <circle cx="100" cy="24" r="12" fill={bc} />
          <circle cx="100" cy="24" r="12" fill="none" stroke={darken(bc)} strokeWidth="1" />
          <circle cx="96"  cy="21" r="5"  fill={lighten(bc)} fillOpacity="0.4" />
          {/* Top knit texture */}
          <path d="M60,64 Q80,45 100,40 Q120,45 140,64" fill="none" stroke={lighten(bc)} strokeWidth="1" strokeDasharray="4,3" />
          <path d="M65,58 Q82,42 100,38 Q118,42 135,58" fill="none" stroke={lighten(bc)} strokeWidth="0.8" strokeDasharray="3,4" />
        </g>
      );
    }
    case 'none':
    default:
      return null;
  }
}

// ─── Shirt Body Renderer ────────────────────────────────────────────────────
function renderShirtBody(config: Avatar3DConfig, gradId: string, skin: { base: string; shadow: string; highlight: string }) {
  const c = config.shirtColor;
  switch (config.shirtStyle) {
    case 'tshirt':
      return (
        <g>
          {/* Torso */}
          <rect x="42" y="142" width="116" height="106" rx="8" fill={c} />
          <rect x="42" y="142" width="116" height="106" rx="8" fill={`url(#${gradId})`} />
          <rect x="42" y="142" width="116" height="106" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Collar */}
          <path d="M80,142 Q100,155 120,142" fill="none" stroke={darken(c)} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'tank':
      return (
        <g>
          {/* Tank top body */}
          <rect x="52" y="148" width="96" height="100" rx="6" fill={c} />
          <rect x="52" y="148" width="96" height="100" rx="6" fill={`url(#${gradId})`} />
          <rect x="52" y="148" width="96" height="100" rx="6" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Left strap */}
          <rect x="72" y="138" width="14" height="15" rx="4" fill={c} />
          <rect x="72" y="138" width="14" height="15" rx="4" fill={`url(#${gradId})`} />
          <rect x="72" y="138" width="14" height="15" rx="4" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right strap */}
          <rect x="114" y="138" width="14" height="15" rx="4" fill={c} />
          <rect x="114" y="138" width="14" height="15" rx="4" fill={`url(#${gradId})`} />
          <rect x="114" y="138" width="14" height="15" rx="4" fill="none" stroke={darken(c)} strokeWidth="1" />
        </g>
      );
    case 'hoodie':
      return (
        <g>
          {/* Torso */}
          <rect x="40" y="140" width="120" height="110" rx="10" fill={c} />
          <rect x="40" y="140" width="120" height="110" rx="10" fill={`url(#${gradId})`} />
          <rect x="40" y="140" width="120" height="110" rx="10" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Front pocket */}
          <rect x="70" y="210" width="60" height="30" rx="5" fill={darken(c)} fillOpacity="0.4" />
          <line x1="100" y1="212" x2="100" y2="238" stroke={darken(c)} strokeWidth="1" strokeDasharray="2,2" />
          {/* Hood behind neck */}
          <path d="M78,143 Q78,128 100,124 Q122,128 122,143 Q110,138 100,137 Q90,138 78,143 Z"
            fill={c} />
          <path d="M78,143 Q78,128 100,124 Q122,128 122,143 Q110,138 100,137 Q90,138 78,143 Z"
            fill={`url(#${gradId})`} />
          <path d="M78,143 Q78,128 100,124 Q122,128 122,143" fill="none" stroke={darken(c)} strokeWidth="1.2" />
          {/* Drawstrings */}
          <path d="M94,142 L90,165" stroke={darken(c)} strokeWidth="1.5" strokeLinecap="round" />
          <path d="M106,142 L110,165" stroke={darken(c)} strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="90" cy="166" r="3" fill={darken(c)} />
          <circle cx="110" cy="166" r="3" fill={darken(c)} />
        </g>
      );
    case 'button-down':
      return (
        <g>
          {/* Torso */}
          <rect x="42" y="142" width="116" height="106" rx="6" fill={c} />
          <rect x="42" y="142" width="116" height="106" rx="6" fill={`url(#${gradId})`} />
          <rect x="42" y="142" width="116" height="106" rx="6" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Center line */}
          <line x1="100" y1="145" x2="100" y2="248" stroke={darken(c)} strokeWidth="1" />
          {/* Collar triangles */}
          <path d="M100,142 L88,130 L94,142 Z" fill={c} />
          <path d="M100,142 L112,130 L106,142 Z" fill={c} />
          <path d="M100,142 L88,130 L94,142 Z" fill="none" stroke={darken(c)} strokeWidth="0.8" />
          <path d="M100,142 L112,130 L106,142 Z" fill="none" stroke={darken(c)} strokeWidth="0.8" />
          {/* Buttons */}
          <circle cx="100" cy="162" r="3" fill={darken(c)} />
          <circle cx="100" cy="180" r="3" fill={darken(c)} />
          <circle cx="100" cy="198" r="3" fill={darken(c)} />
          <circle cx="100" cy="216" r="3" fill={darken(c)} />
        </g>
      );
    case 'pittsburgh':
      return (
        <g>
          {/* Pittsburgh Tee - gold */}
          <rect x="42" y="142" width="116" height="106" rx="8" fill="#FFD100" />
          <rect x="42" y="142" width="116" height="106" rx="8" fill={`url(#${gradId})`} />
          <rect x="42" y="142" width="116" height="106" rx="8" fill="none" stroke="#B89200" strokeWidth="1" />
          {/* Steel beam accent */}
          <line x1="48" y1="175" x2="152" y2="175" stroke="#000000" strokeWidth="3" />
          <line x1="48" y1="179" x2="152" y2="179" stroke="#000000" strokeWidth="1.5" />
          {/* PGH text */}
          <text x="100" y="210" textAnchor="middle" fontSize="18" fontWeight="bold" fill="#000000" fontFamily="Arial, sans-serif">PGH</text>
          {/* Collar */}
          <path d="M80,142 Q100,155 120,142" fill="none" stroke="#B89200" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'cyba':
      return (
        <g>
          {/* CYBA Tee - purple */}
          <rect x="42" y="142" width="116" height="106" rx="8" fill="#6D28D9" />
          <rect x="42" y="142" width="116" height="106" rx="8" fill={`url(#${gradId})`} />
          <rect x="42" y="142" width="116" height="106" rx="8" fill="none" stroke="#4C1D95" strokeWidth="1" />
          {/* Heart symbol */}
          <path d="M93,175 Q93,168 100,172 Q107,168 107,175 Q107,183 100,190 Q93,183 93,175 Z"
            fill="#EC4899" />
          {/* CYBA text */}
          <text x="100" y="215" textAnchor="middle" fontSize="16" fontWeight="bold" fill="#FFFFFF" fontFamily="Arial, sans-serif">CYBA</text>
          {/* Collar */}
          <path d="M80,142 Q100,155 120,142" fill="none" stroke="#4C1D95" strokeWidth="1.5" strokeLinecap="round" />
          {/* Stars decoration */}
          <text x="60" y="165" fontSize="10" fill="#A78BFA">★</text>
          <text x="134" y="165" fontSize="10" fill="#A78BFA">★</text>
        </g>
      );
    default:
      return null;
  }
}

// ─── Arms Renderer ───────────────────────────────────────────────────────────
function renderArms(config: Avatar3DConfig, gradId: string, skin: { base: string; shadow: string; highlight: string }) {
  const sc = config.shirtColor;
  const hasLongSleeve = ['hoodie', 'button-down'].includes(config.shirtStyle);
  const hasShortSleeve = ['tshirt', 'pittsburgh', 'cyba'].includes(config.shirtStyle);
  const isTank = config.shirtStyle === 'tank';

  return (
    <g>
      {/* Left arm — skin */}
      <rect x="14" y="152" width="29" height="78" rx="12" fill={skin.base} />
      <rect x="14" y="152" width="29" height="78" rx="12" fill="none" stroke={skin.shadow} strokeWidth="0.7" />
      {/* Left hand */}
      <ellipse cx="28" cy="236" rx="14" ry="10" fill={skin.base} />
      <ellipse cx="28" cy="236" rx="14" ry="10" fill="none" stroke={skin.shadow} strokeWidth="0.7" />

      {/* Right arm — skin */}
      <rect x="157" y="152" width="29" height="78" rx="12" fill={skin.base} />
      <rect x="157" y="152" width="29" height="78" rx="12" fill="none" stroke={skin.shadow} strokeWidth="0.7" />
      {/* Right hand */}
      <ellipse cx="172" cy="236" rx="14" ry="10" fill={skin.base} />
      <ellipse cx="172" cy="236" rx="14" ry="10" fill="none" stroke={skin.shadow} strokeWidth="0.7" />

      {/* Shirt sleeve overlays */}
      {hasLongSleeve && (
        <>
          <rect x="14" y="152" width="29" height="78" rx="12" fill={sc} />
          <rect x="14" y="152" width="29" height="78" rx="12" fill={`url(#${gradId})`} />
          <rect x="14" y="152" width="29" height="78" rx="12" fill="none" stroke={darken(sc)} strokeWidth="0.7" />
          <rect x="157" y="152" width="29" height="78" rx="12" fill={sc} />
          <rect x="157" y="152" width="29" height="78" rx="12" fill={`url(#${gradId})`} />
          <rect x="157" y="152" width="29" height="78" rx="12" fill="none" stroke={darken(sc)} strokeWidth="0.7" />
          {/* Cuffs */}
          <rect x="14" y="218" width="29" height="12" rx="6" fill={darken(sc)} />
          <rect x="157" y="218" width="29" height="12" rx="6" fill={darken(sc)} />
        </>
      )}
      {hasShortSleeve && (
        <>
          <rect x="14" y="152" width="29" height="38" rx="12" fill={sc} />
          <rect x="14" y="152" width="29" height="38" rx="12" fill={`url(#${gradId})`} />
          <rect x="14" y="152" width="29" height="38" rx="12" fill="none" stroke={darken(sc)} strokeWidth="0.7" />
          <rect x="157" y="152" width="29" height="38" rx="12" fill={sc} />
          <rect x="157" y="152" width="29" height="38" rx="12" fill={`url(#${gradId})`} />
          <rect x="157" y="152" width="29" height="38" rx="12" fill="none" stroke={darken(sc)} strokeWidth="0.7" />
        </>
      )}
      {isTank && (
        <>
          {/* No arm overlay, just tiny shoulder caps */}
          <rect x="20" y="152" width="22" height="10" rx="5" fill={sc} />
          <rect x="158" y="152" width="22" height="10" rx="5" fill={sc} />
        </>
      )}
    </g>
  );
}

// ─── Pants Renderer ──────────────────────────────────────────────────────────
function renderPants(config: Avatar3DConfig, gradId: string) {
  const c = config.pantsColor;
  switch (config.pantsStyle) {
    case 'jeans':
      return (
        <g>
          {/* Waistband */}
          <rect x="42" y="244" width="116" height="14" rx="4" fill={darken(c)} />
          {/* Left leg */}
          <rect x="55" y="252" width="37" height="96" rx="8" fill={c} />
          <rect x="55" y="252" width="37" height="96" rx="8" fill={`url(#${gradId})`} />
          <rect x="55" y="252" width="37" height="96" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Left seam */}
          <line x1="73" y1="255" x2="73" y2="345" stroke={darken(c)} strokeWidth="1" strokeDasharray="3,2" />
          {/* Right leg */}
          <rect x="108" y="252" width="37" height="96" rx="8" fill={c} />
          <rect x="108" y="252" width="37" height="96" rx="8" fill={`url(#${gradId})`} />
          <rect x="108" y="252" width="37" height="96" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right seam */}
          <line x1="127" y1="255" x2="127" y2="345" stroke={darken(c)} strokeWidth="1" strokeDasharray="3,2" />
        </g>
      );
    case 'cargo':
      return (
        <g>
          {/* Waistband */}
          <rect x="42" y="244" width="116" height="14" rx="4" fill={darken(c)} />
          {/* Left leg */}
          <rect x="55" y="252" width="37" height="96" rx="8" fill={c} />
          <rect x="55" y="252" width="37" height="96" rx="8" fill={`url(#${gradId})`} />
          <rect x="55" y="252" width="37" height="96" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Left cargo pocket */}
          <rect x="56" y="285" width="22" height="24" rx="3" fill={darken(c)} fillOpacity="0.5" />
          <line x1="56" y1="297" x2="78" y2="297" stroke={darken(c)} strokeWidth="0.8" />
          {/* Right leg */}
          <rect x="108" y="252" width="37" height="96" rx="8" fill={c} />
          <rect x="108" y="252" width="37" height="96" rx="8" fill={`url(#${gradId})`} />
          <rect x="108" y="252" width="37" height="96" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right cargo pocket */}
          <rect x="122" y="285" width="22" height="24" rx="3" fill={darken(c)} fillOpacity="0.5" />
          <line x1="122" y1="297" x2="144" y2="297" stroke={darken(c)} strokeWidth="0.8" />
          {/* Belt */}
          <rect x="44" y="250" width="112" height="8" rx="3" fill={darken(c)} />
          <rect x="96" y="249" width="8" height="10" rx="1" fill="#888888" />
        </g>
      );
    case 'shorts':
      return (
        <g>
          {/* Waistband */}
          <rect x="42" y="244" width="116" height="14" rx="4" fill={darken(c)} />
          {/* Left short leg */}
          <rect x="55" y="252" width="37" height="56" rx="8" fill={c} />
          <rect x="55" y="252" width="37" height="56" rx="8" fill={`url(#${gradId})`} />
          <rect x="55" y="252" width="37" height="56" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Left hem */}
          <rect x="55" y="300" width="37" height="6" rx="3" fill={darken(c)} fillOpacity="0.5" />
          {/* Right short leg */}
          <rect x="108" y="252" width="37" height="56" rx="8" fill={c} />
          <rect x="108" y="252" width="37" height="56" rx="8" fill={`url(#${gradId})`} />
          <rect x="108" y="252" width="37" height="56" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right hem */}
          <rect x="108" y="300" width="37" height="6" rx="3" fill={darken(c)} fillOpacity="0.5" />
          {/* Calves (skin) - will be rendered below, just show here as placeholder - handled by shoe renderer knowing shorts */}
        </g>
      );
    case 'skirt':
      return (
        <g>
          {/* Waistband */}
          <rect x="42" y="244" width="116" height="10" rx="4" fill={darken(c)} />
          {/* Skirt trapezoid */}
          <path d="M42,252 L158,252 L168,315 L32,315 Z" fill={c} />
          <path d="M42,252 L158,252 L168,315 L32,315 Z" fill={`url(#${gradId})`} />
          <path d="M42,252 L158,252 L168,315 L32,315 Z" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Pleats */}
          <line x1="68"  y1="253" x2="56"  y2="314" stroke={darken(c)} strokeWidth="0.8" />
          <line x1="84"  y1="252" x2="76"  y2="314" stroke={darken(c)} strokeWidth="0.8" />
          <line x1="100" y1="252" x2="100" y2="314" stroke={darken(c)} strokeWidth="0.8" />
          <line x1="116" y1="252" x2="124" y2="314" stroke={darken(c)} strokeWidth="0.8" />
          <line x1="132" y1="253" x2="144" y2="314" stroke={darken(c)} strokeWidth="0.8" />
          {/* Left calf */}
          <rect x="60" y="315" width="28" height="30" rx="6" fill={darken(c)} fillOpacity="0.6" />
          {/* Right calf */}
          <rect x="112" y="315" width="28" height="30" rx="6" fill={darken(c)} fillOpacity="0.6" />
        </g>
      );
    case 'ripped':
      return (
        <g>
          {/* Waistband */}
          <rect x="42" y="244" width="116" height="14" rx="4" fill={darken(c)} />
          {/* Left leg */}
          <rect x="55" y="252" width="37" height="96" rx="8" fill={c} />
          <rect x="55" y="252" width="37" height="96" rx="8" fill={`url(#${gradId})`} />
          <rect x="55" y="252" width="37" height="96" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Rips left knee */}
          <path d="M58,292 L72,288 M60,298 L75,293 M57,304 L70,300" stroke={darken(c)} strokeWidth="1.5" />
          <path d="M62,290 L65,308" stroke="#CCCCCC" strokeWidth="0.8" fillOpacity="0.4" />
          <path d="M67,289 L70,307" stroke="#CCCCCC" strokeWidth="0.8" fillOpacity="0.4" />
          {/* Right leg */}
          <rect x="108" y="252" width="37" height="96" rx="8" fill={c} />
          <rect x="108" y="252" width="37" height="96" rx="8" fill={`url(#${gradId})`} />
          <rect x="108" y="252" width="37" height="96" rx="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Rips right knee */}
          <path d="M112,292 L128,288 M114,298 L130,293 M111,304 L124,300" stroke={darken(c)} strokeWidth="1.5" />
          <path d="M116,290 L119,308" stroke="#CCCCCC" strokeWidth="0.8" />
          <path d="M121,289 L124,307" stroke="#CCCCCC" strokeWidth="0.8" />
          {/* Seams */}
          <line x1="73"  y1="255" x2="73"  y2="345" stroke={darken(c)} strokeWidth="0.8" strokeDasharray="3,2" />
          <line x1="127" y1="255" x2="127" y2="345" stroke={darken(c)} strokeWidth="0.8" strokeDasharray="3,2" />
        </g>
      );
    case 'sweats':
      return (
        <g>
          {/* Waistband with drawstring */}
          <rect x="42" y="244" width="116" height="16" rx="6" fill={darken(c)} />
          <line x1="88" y1="252" x2="84" y2="268" stroke={darken(c)} strokeWidth="2" strokeLinecap="round" />
          <line x1="112" y1="252" x2="116" y2="268" stroke={darken(c)} strokeWidth="2" strokeLinecap="round" />
          <circle cx="84" cy="269" r="3" fill={darken(c)} />
          <circle cx="116" cy="269" r="3" fill={darken(c)} />
          {/* Left leg */}
          <rect x="52" y="256" width="40" height="92" rx="10" fill={c} />
          <rect x="52" y="256" width="40" height="92" rx="10" fill={`url(#${gradId})`} />
          <rect x="52" y="256" width="40" height="92" rx="10" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Left ankle cuff */}
          <rect x="52" y="336" width="40" height="12" rx="6" fill={darken(c)} />
          {/* Right leg */}
          <rect x="108" y="256" width="40" height="92" rx="10" fill={c} />
          <rect x="108" y="256" width="40" height="92" rx="10" fill={`url(#${gradId})`} />
          <rect x="108" y="256" width="40" height="92" rx="10" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right ankle cuff */}
          <rect x="108" y="336" width="40" height="12" rx="6" fill={darken(c)} />
        </g>
      );
    default:
      return null;
  }
}

// ─── Shoes Renderer ──────────────────────────────────────────────────────────
function renderShoes(config: Avatar3DConfig, gradId: string) {
  const c = config.shoeColor;
  const isShorts = config.pantsStyle === 'shorts';
  const isSkirt  = config.pantsStyle === 'skirt';

  // For shorts/skirt, render bare calves first
  const calves = (isShorts || isSkirt) ? (
    <g>
      <rect x="60" y={isShorts ? 308 : 315} width="28" height={isShorts ? 37 : 30} rx="6" fill="#C68642" />
      <rect x="112" y={isShorts ? 308 : 315} width="28" height={isShorts ? 37 : 30} rx="6" fill="#C68642" />
    </g>
  ) : null;

  switch (config.shoeStyle) {
    case 'boots':
      return (
        <g>
          {calves}
          {/* Tall boot left */}
          <rect x="52" y="318" width="40" height="52" rx="8" fill={c} />
          <rect x="52" y="318" width="40" height="52" rx="8" fill={`url(#${gradId})`} />
          <rect x="52" y="318" width="40" height="52" rx="8" fill="none" stroke={darken(c)} strokeWidth="1.2" />
          {/* Boot sole left */}
          <rect x="48" y="362" width="48" height="8" rx="4" fill={darken(c)} />
          {/* Boot laces left */}
          <line x1="62" y1="328" x2="82" y2="328" stroke={darken(c)} strokeWidth="1.2" />
          <line x1="62" y1="336" x2="82" y2="336" stroke={darken(c)} strokeWidth="1.2" />
          <line x1="62" y1="344" x2="82" y2="344" stroke={darken(c)} strokeWidth="1.2" />
          {/* Tall boot right */}
          <rect x="108" y="318" width="40" height="52" rx="8" fill={c} />
          <rect x="108" y="318" width="40" height="52" rx="8" fill={`url(#${gradId})`} />
          <rect x="108" y="318" width="40" height="52" rx="8" fill="none" stroke={darken(c)} strokeWidth="1.2" />
          {/* Boot sole right */}
          <rect x="104" y="362" width="48" height="8" rx="4" fill={darken(c)} />
          {/* Boot laces right */}
          <line x1="118" y1="328" x2="138" y2="328" stroke={darken(c)} strokeWidth="1.2" />
          <line x1="118" y1="336" x2="138" y2="336" stroke={darken(c)} strokeWidth="1.2" />
          <line x1="118" y1="344" x2="138" y2="344" stroke={darken(c)} strokeWidth="1.2" />
        </g>
      );
    case 'sneakers':
      return (
        <g>
          {calves}
          {/* Left sneaker */}
          <rect x="52" y="345" width="40" height="26" rx="7" fill={c} />
          <rect x="52" y="345" width="40" height="26" rx="7" fill={`url(#${gradId})`} />
          <rect x="52" y="345" width="40" height="26" rx="7" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Left sole */}
          <rect x="48" y="364" width="46" height="8" rx="4" fill={darken(c)} />
          {/* Left tongue */}
          <rect x="62" y="344" width="18" height="10" rx="3" fill={c} />
          {/* Left laces */}
          <line x1="63" y1="350" x2="79" y2="350" stroke={darken(c)} strokeWidth="1" />
          <line x1="64" y1="355" x2="78" y2="355" stroke={darken(c)} strokeWidth="1" />
          {/* Left accent stripe */}
          <path d="M54,348 Q60,352 54,362" fill="none" stroke={darken(c)} strokeWidth="1.5" strokeLinecap="round" />
          {/* Right sneaker */}
          <rect x="108" y="345" width="40" height="26" rx="7" fill={c} />
          <rect x="108" y="345" width="40" height="26" rx="7" fill={`url(#${gradId})`} />
          <rect x="108" y="345" width="40" height="26" rx="7" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right sole */}
          <rect x="106" y="364" width="46" height="8" rx="4" fill={darken(c)} />
          {/* Right tongue */}
          <rect x="120" y="344" width="18" height="10" rx="3" fill={c} />
          {/* Right laces */}
          <line x1="121" y1="350" x2="137" y2="350" stroke={darken(c)} strokeWidth="1" />
          <line x1="122" y1="355" x2="136" y2="355" stroke={darken(c)} strokeWidth="1" />
          {/* Right accent stripe */}
          <path d="M146,348 Q140,352 146,362" fill="none" stroke={darken(c)} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      );
    case 'slippers':
      return (
        <g>
          {calves}
          {/* Left slipper — wide oval */}
          <ellipse cx="72" cy="358" rx="26" ry="12" fill={c} />
          <ellipse cx="72" cy="358" rx="26" ry="12" fill={`url(#${gradId})`} />
          <ellipse cx="72" cy="358" rx="26" ry="12" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Fuzzy texture left */}
          <ellipse cx="72" cy="354" rx="20" ry="7" fill={lighten(c)} fillOpacity="0.5" />
          {/* Left toe */}
          <ellipse cx="90" cy="357" rx="10" ry="8" fill={c} />
          <ellipse cx="90" cy="357" rx="10" ry="8" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Right slipper */}
          <ellipse cx="128" cy="358" rx="26" ry="12" fill={c} />
          <ellipse cx="128" cy="358" rx="26" ry="12" fill={`url(#${gradId})`} />
          <ellipse cx="128" cy="358" rx="26" ry="12" fill="none" stroke={darken(c)} strokeWidth="1" />
          {/* Fuzzy texture right */}
          <ellipse cx="128" cy="354" rx="20" ry="7" fill={lighten(c)} fillOpacity="0.5" />
          {/* Right toe */}
          <ellipse cx="110" cy="357" rx="10" ry="8" fill={c} />
          <ellipse cx="110" cy="357" rx="10" ry="8" fill="none" stroke={darken(c)} strokeWidth="1" />
        </g>
      );
    case 'heels':
      return (
        <g>
          {calves}
          {/* Left heel shoe */}
          <path d="M56,345 Q68,340 84,345 L88,365 Q84,370 72,372 Q60,370 52,365 Z" fill={c} />
          <path d="M56,345 Q68,340 84,345 L88,365 Q84,370 72,372 Q60,370 52,365 Z"
            fill={`url(#${gradId})`} />
          <path d="M56,345 Q68,340 84,345 L88,365 Q84,370 72,372 Q60,370 52,365 Z"
            fill="none" stroke={darken(c)} strokeWidth="1.2" />
          {/* Left stiletto heel post */}
          <rect x="53" y="362" width="4" height="14" rx="2" fill={darken(c)} />
          {/* Left toe box curve */}
          <ellipse cx="82" cy="362" rx="8" ry="6" fill={darken(c)} fillOpacity="0.3" />
          {/* Left strap */}
          <path d="M60,348 Q72,344 82,348" fill="none" stroke={darken(c)} strokeWidth="2" strokeLinecap="round" />

          {/* Right heel shoe */}
          <path d="M116,345 Q128,340 144,345 L148,365 Q144,370 128,372 Q116,370 112,365 Z" fill={c} />
          <path d="M116,345 Q128,340 144,345 L148,365 Q144,370 128,372 Q116,370 112,365 Z"
            fill={`url(#${gradId})`} />
          <path d="M116,345 Q128,340 144,345 L148,365 Q144,370 128,372 Q116,370 112,365 Z"
            fill="none" stroke={darken(c)} strokeWidth="1.2" />
          {/* Right stiletto heel post */}
          <rect x="143" y="362" width="4" height="14" rx="2" fill={darken(c)} />
          {/* Right toe box curve */}
          <ellipse cx="118" cy="362" rx="8" ry="6" fill={darken(c)} fillOpacity="0.3" />
          {/* Right strap */}
          <path d="M118,348 Q128,344 140,348" fill="none" stroke={darken(c)} strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    default:
      return null;
  }
}

// ─── Color utilities ─────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [100, 100, 100];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
}

function darken(hex: string, amount = 0.25): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

function lighten(hex: string, amount = 0.3): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}
