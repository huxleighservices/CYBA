'use client';

import { LEVEL_CONFIG, type Level } from '@/lib/levels';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function LevelBadge({ level, size = 'sm' }: { level: Level; size?: 'sm' | 'md' | 'lg' }) {
  const config = LEVEL_CONFIG[level];
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'md' ? 'text-lg' : 'text-sm';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`${sizeClass} leading-none cursor-default select-none`}>
            {config.emoji}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-center">
          <p className="font-bold">{config.name}</p>
          <p className="text-xs text-muted-foreground">{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
