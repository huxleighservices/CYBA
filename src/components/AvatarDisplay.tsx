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

export function AvatarDisplay({
  avatarConfig,
  size = 128,
  className,
}: {
  avatarConfig?: Partial<AvatarConfig>;
  size?: number;
  className?: string;
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

  return (
    <div
      className={cn('relative', className)}
      style={{ width: size, height: size }}
    >
      <div
        className={cn('relative bg-muted/30 rounded-lg w-full h-full')}
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
      {config.emojiStatus && (
        <div
            className="absolute text-center bg-card border rounded-full shadow-lg flex items-center justify-center"
            style={{
                fontSize: size / 4,
                width: size / 2.5,
                height: size / 2.5,
                top: `-${size / 10}px`,
                right: `-${size / 10}px`,
                zIndex: 99,
            }}
        >
            {config.emojiStatus === 'CYBA_SWIRL' ? (
                <Image src="/cyblogo.png" alt="CYBA Swirl" width={size/3} height={size/3} className="animate-slow-spin" />
              ) : (
                <div className="relative" style={{ bottom: `${size/40}px` }}>
                  {config.emojiStatus}
                </div>
            )}
            <div
                className="absolute w-0 h-0"
                style={{
                    borderLeft: `${size / 20}px solid transparent`,
                    borderRight: `${size / 20}px solid transparent`,
                    borderTop: `${size / 12}px solid hsl(var(--border))`,
                    bottom: `-${size / 12 - 1}px`,
                    left: '20%',
                    transform: 'translateX(-50%) rotate(45deg)'
                }}
            ></div>
             <div
                className="absolute w-0 h-0"
                style={{
                    borderLeft: `${size / 22}px solid transparent`,
                    borderRight: `${size / 22}px solid transparent`,
                    borderTop: `${size / 13}px solid hsl(var(--card))`,
                    bottom: `-${size / 13}px`,
                    left: '20%',
                    transform: 'translateX(-50%) rotate(45deg)',
                    zIndex: 1
                }}
            ></div>
        </div>
      )}
    </div>
  );
}
