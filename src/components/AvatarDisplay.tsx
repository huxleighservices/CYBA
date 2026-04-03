'use client';

import Image from 'next/image';
import {
  avatarOptions,
  AvatarConfig,
  defaultAvatarConfig,
  AvatarLayer,
  defaultLayerOrder,
} from '@/lib/avatar-assets';
import { cn } from '@/lib/utils';
import { type Level, LEVEL_CONFIG } from '@/lib/levels';

const LEVEL_GLOW: Record<Level, string> = {
  spark: '',
  charge: '0 0 8px 2px rgba(96,165,250,0.45)',
  surge: '0 0 8px 2px rgba(168,85,247,0.45)',
  storm: '0 0 8px 2px rgba(239,68,68,0.45)',
};

export function AvatarDisplay({
  avatarConfig,
  profilePictureUrl,
  size = 128,
  className,
  level,
}: {
  avatarConfig?: Partial<AvatarConfig>;
  profilePictureUrl?: string;
  size?: number;
  className?: string;
  level?: Level;
}) {
  const config = { ...defaultAvatarConfig, ...avatarConfig };
  const order =
    config.layerOrder && config.layerOrder.length > 0
      ? config.layerOrder
      : defaultLayerOrder;

  const getOption = (category: AvatarLayer) => {
    const options = avatarOptions[category];
    const index = config[category] || 0;
    return options[index] || options[0];
  };

  const levelConfig = level ? LEVEL_CONFIG[level] : null;
  const ringClass = level ? levelConfig?.ringClass ?? '' : '';
  const glowStyle = level ? LEVEL_GLOW[level] : '';

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
    >
      {profilePictureUrl ? (
        <div
          className={cn('relative bg-muted/30 rounded-full w-full h-full overflow-hidden', ringClass)}
          style={glowStyle ? { boxShadow: glowStyle } : undefined}
        >
          <Image
            src={profilePictureUrl}
            alt="Profile picture"
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div
          className={cn('relative bg-muted/30 rounded-lg w-full h-full', ringClass)}
          style={glowStyle ? { boxShadow: glowStyle } : undefined}
        >
          {order.map((layerKey, index) => {
            const option = getOption(layerKey);
            if (!option || option.name === 'None') {
              return null;
            }
            return (
              <Image
                key={layerKey}
                src={option.url}
                alt={option.name}
                fill
                className="object-contain"
                style={{ zIndex: (index + 1) * 10 }}
                priority={layerKey === 'skin'}
                data-ai-hint={option.hint}
              />
            );
          })}
        </div>
      )}
      {config.emojiStatus && (
        <div
            className="absolute text-center bg-card border border-border/80 rounded-full shadow-[0_0_12px_rgba(0,0,0,0.7)] flex items-center justify-center pointer-events-none"
            style={{
                fontSize: size / 4,
                width: size / 2.5,
                height: size / 2.5,
                bottom: `-${size / 14}px`,
                right: `-${size / 14}px`,
                zIndex: 50,
            }}
        >
            {config.emojiStatus === 'CYBA_SWIRL' ? (
                <Image src="/cyblogo.png" alt="CYBA Swirl" width={size/3} height={size/3} className="animate-slow-spin" />
              ) : (
                config.emojiStatus
            )}
        </div>
      )}
    </div>
  );
}
