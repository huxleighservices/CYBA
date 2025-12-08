import { Construction } from 'lucide-react';

export default function MerchPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16 text-center">
      <div>
        <Construction className="mx-auto h-16 w-16 text-primary" />
        <h1 className="mt-8 text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Merch Page In Development
        </h1>
        <p className="text-lg text-foreground/80">
          Our team is working hard to bring you exclusive CYBA family gear.
          Please check back soon!
        </p>
      </div>
    </div>
  );
}
