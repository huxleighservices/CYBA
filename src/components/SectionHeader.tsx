import { cn } from '@/lib/utils';

export function SectionHeader({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn('max-w-2xl mb-6', className)}>
      <h1 className="text-lg md:text-xl font-headline font-bold text-glow mb-1">{title}</h1>
      {description && <p className="text-xs text-foreground/70">{description}</p>}
    </div>
  );
}
