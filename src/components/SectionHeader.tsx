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
    <div className={cn('max-w-2xl mb-8', className)}>
      <h1 className="text-2xl md:text-3xl font-headline font-bold text-glow mb-1">{title}</h1>
      {description && <p className="text-sm text-foreground/70">{description}</p>}
    </div>
  );
}
