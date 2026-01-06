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
import { Check, Loader2, DollarSign } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import Image from 'next/image';
import { useMemo } from 'react';

function ItemCard({ item }: { item: any }) {
  const isBoost = item.type === 'boost';

  return (
    <Card
      key={item.id}
      className="flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary"
    >
      <CardHeader className="items-center text-center">
        <CardTitle className="text-2xl font-bold tracking-widest">
          {item.name}
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span className="text-4xl font-bold text-foreground">
            {item.price}
          </span>
          {isBoost ? (
            <DollarSign className="h-8 w-8 text-primary" />
          ) : (
            <Image src="/CCoin.png?v=3" alt="CYBACOIN" width={42} height={42} />
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <p className="text-center text-foreground/70 min-h-[40px]">
          {item.description}
        </p>
        <ul className="space-y-2">
          {item.features?.map((feature: string, index: number) => (
            <li key={index} className="flex items-center">
              <Check className="h-4 w-4 mr-2 text-primary" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button className="w-full" asChild>
          <Link href={item.buttonLink}>{item.buttonText}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}


export default function ExtrasPage() {
  const { firestore } = useFirebase();
  
  const extrasQuery = useMemoFirebase(
    () => query(collection(firestore, 'extras'), orderBy('order')),
    [firestore]
  );
  const { data: extras, isLoading } = useCollection(extrasQuery);

  const boosts = useMemo(() => extras?.filter(e => e.type === 'boost') || [], [extras]);
  const rewards = useMemo(() => extras?.filter(e => e.type === 'reward') || [], [extras]);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          BOOSTS & REWARDS
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Amplify your presence with BOOSTS or redeem your CYBACOIN for exclusive Rewards
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-12">
            {/* BOOSTS SECTION */}
            <section>
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-headline font-bold text-glow">BOOSTS</h2>
                    <p className="text-md text-foreground/70 mt-2">
                        Add-ons to increase your exposure and engagement.
                    </p>
                </div>
                <div className="space-y-8">
                    {boosts?.length > 0 ? (
                        boosts.map((item) => <ItemCard key={item.id} item={item} />)
                    ) : (
                        <p className="text-center text-foreground/60">No boosts available at the moment.</p>
                    )}
                </div>
            </section>

            {/* REWARDS SECTION */}
            <section>
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-headline font-bold text-glow">REWARDS</h2>
                     <p className="text-md text-foreground/70 mt-2">
                        Redeem your CYBACOIN for special opportunities.
                    </p>
                </div>
                <div className="space-y-8">
                    {rewards?.length > 0 ? (
                        rewards.map((item) => <ItemCard key={item.id} item={item} />)
                    ) : (
                        <p className="text-center text-foreground/60">No rewards available at the moment.</p>
                    )}
                </div>
            </section>
        </div>
      )}
    </div>
  );
}
    