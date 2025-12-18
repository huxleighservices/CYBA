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
import { Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';

export default function MembershipPage() {
  const { firestore } = useFirebase();
  const membershipsRef = useMemoFirebase(
    () => collection(firestore, 'memberships'),
    [firestore]
  );
  const { data: memberships, isLoading } = useCollection(membershipsRef);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          JOIN THE CYBAZONE
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Choose your level. Billed weekly. Cancel anytime.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {memberships?.map((tier) => (
            <Card
              key={tier.id}
              className="flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary"
            >
              <CardHeader className="items-center text-center">
                <CardTitle className="text-2xl font-bold tracking-widest">
                  {tier.name}
                </CardTitle>
                <CardDescription>
                  <span className="text-4xl font-bold text-foreground">
                    ${tier.price > 0 ? tier.price.toFixed(2) : 'Free'}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <p className="text-center text-foreground/70">
                  {tier.description}
                </p>
                <ul className="space-y-2">
                  {tier.features?.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center">
                      <Check className="h-4 w-4 mr-2 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" asChild>
                  <Link href={tier.buttonLink}>{tier.buttonText}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
