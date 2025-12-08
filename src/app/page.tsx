import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Link from 'next/link';
import { ArrowRight, Mic, Music, Users } from 'lucide-react';

const services = [
  {
    icon: <Mic className="h-8 w-8 text-primary" />,
    title: 'Artist Promotion',
    description: 'Amplify your reach with our targeted marketing campaigns.',
  },
  {
    icon: <Music className="h-8 w-8 text-primary" />,
    title: 'Music Distribution',
    description: 'Get your tracks on all major streaming platforms worldwide.',
  },
  {
    icon: <Users className="h-8 w-8 text-primary" />,
    title: 'Community Building',
    description: 'Connect with your fans and build a loyal community.',
  },
];

export default function Home() {
  const heroImage = PlaceHolderImages.find((p) => p.id === 'hero');

  return (
    <div className="container mx-auto px-4 py-8 md:py-16">
      <section className="relative text-center rounded-lg overflow-hidden mb-16">
        <div className="relative z-10 px-6 py-24 md:py-32">
          <h1 className="text-4xl md:text-7xl font-headline font-bold mb-8 tracking-tighter animate-text-glow">
            Welcome to the CYBAVerse
          </h1>
          <Button
            asChild
            size="lg"
            className="font-bold group"
          >
            <Link href="/membership">
              Join the Galaxy{' '}
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-3xl font-headline font-bold text-center mb-10 text-glow">
          Our Services
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {services.map((service) => (
            <Card
              key={service.title}
              className="bg-card/50 border-primary/20 backdrop-blur-sm transform hover:-translate-y-2 transition-transform duration-300"
            >
              <CardHeader className="items-center">
                {service.icon}
                <CardTitle className="mt-4">{service.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center text-foreground/70">
                  {service.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="text-center bg-card/50 border border-primary/20 rounded-lg p-8 md:p-12">
        <h2 className="text-3xl font-headline font-bold mb-4 text-glow">
          Ready to Launch?
        </h2>
        <p className="text-foreground/80 max-w-2xl mx-auto mb-6">
          The stars are waiting. Let's create your legacy together. Explore our
          community and see what's trending on the Cybaboard.
        </p>
        <Button
          asChild
          variant="outline"
          className="border-accent text-accent hover:bg-accent/10 hover:text-accent"
        >
          <Link href="/cybaboard">Explore Cybaboard</Link>
        </Button>
      </section>
    </div>
  );
}
