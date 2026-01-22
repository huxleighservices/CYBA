'use client';

import Image from 'next/image';
import {
  avatarOptions,
  AvatarConfig,
  defaultAvatarConfig,
} from '@/lib/avatar-assets';
import { cn } from '@/lib/utils';

export function AvatarDisplay({
  avatarConfig,
  size = 128,
  className,
}: {
  avatarConfig?: AvatarConfig;
  size?: number;
  className?: string;
}) {
  const config = { ...defaultAvatarConfig, ...avatarConfig };

  const getOption = (category: keyof AvatarConfig) => {
    const options = avatarOptions[category];
    const index = config[category] || 0;
    return options[index] || options[0];
  };

  return (
    <div
      className={cn("relative bg-muted/30 rounded-lg", className)}
      style={{ width: size, height: size }}
    >
       <Image src={getOption('skin').url} alt={getOption('skin').name} fill className="object-contain" style={{ zIndex: 10 }} priority data-ai-hint={getOption('skin').hint} />
       <Image src={getOption('pants').url} alt={getOption('pants').name} fill className="object-contain" style={{ zIndex: 20 }} data-ai-hint={getOption('pants').hint} />
       <Image src={getOption('shoes').url} alt={getOption('shoes').name} fill className="object-contain" style={{ zIndex: 30 }} data-ai-hint={getOption('shoes').hint} />
       <Image src={getOption('shirt').url} alt={getOption('shirt').name} fill className="object-contain" style={{ zIndex: 40 }} data-ai-hint={getOption('shirt').hint} />
       <Image src={getOption('accessory').url} alt={getOption('accessory').name} fill className="object-contain" style={{ zIndex: 50 }} data-ai-hint={getOption('accessory').hint} />
       <Image src={getOption('hat').url} alt={getOption('hat').name} fill className="object-contain" style={{ zIndex: 60 }} data-ai-hint={getOption('hat').hint} />
    </div>
  );
}
