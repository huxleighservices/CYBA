'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Check } from 'lucide-react';
import Link from 'next/link';

const proFeatures = [
  'All Cyba-Free features',
  'Advanced marketing analytics',
  'Priority support',
  'Exclusive industry workshops',
  'Dedicated artist representative',
];

export default function MembershipPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Join our CYBA Family
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Choose the plan that's right for your journey. Start for free or
          unlock professional tools.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        <Card className="flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl font-bold tracking-widest">
              CYBA-FREE
            </CardTitle>
            <CardDescription>
              <span className="text-4xl font-bold text-foreground">Free</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <ul className="space-y-3">
              <li className="flex items-start">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary mr-2" />
                <span className="text-foreground/90">
                  Access to the CYBA Galaxy community
                </span>
              </li>
              <li className="flex items-start">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary mr-2" />
                <span className="text-foreground/90">
                  Post on the Cybaboard
                </span>
              </li>
              <li className="flex items-start">
                <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary mr-2" />
                <span className="text-foreground/90">
                  Connect with other artists
                </span>
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" asChild>
              <Link href="/signup">Create Free Account</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl font-bold tracking-widest">
              CYBA-PRO
            </CardTitle>
            <CardDescription>
              <span className="text-4xl font-bold text-foreground">
                Let's Talk
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-grow">
            <ul className="space-y-3">
              {proFeatures.map((feature, i) => (
                <li key={i} className="flex items-start">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary mr-2" />
                  <span className="text-foreground/90">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="outline" asChild>
              <a href="mailto:sales@cyba-galaxy.com">Get in Touch</a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
