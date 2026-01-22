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
      className={cn('relative bg-muted/30 rounded-lg', className)}
      style={{ width: size, height: size }}
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
  );
}
