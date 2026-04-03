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
import { collection, query, where, orderBy } from 'firebase/firestore';

function ItemCard({ item }: { item: any }) {
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
          <DollarSign className="h-8 w-8 text-primary" />
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

export default function BoostsPage() {
  const { firestore } = useFirebase();

  const boostsQuery = useMemoFirebase(
    () =>
      query(
        collection(firestore, 'extras'),
        where('type', '==', 'boost'),
        orderBy('order')
      ),
    [firestore]
  );
  const { data: boosts, isLoading: isLoadingBoosts } =
    useCollection(boostsQuery);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          BOOSTS
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Amplify your presence with BOOSTS.
        </p>
      </div>

      {isLoadingBoosts ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(boosts?.length ?? 0) > 0 ? (
            boosts?.map((item) => <ItemCard key={item.id} item={item} />)
          ) : (
            <p className="col-span-full text-center text-foreground/60">
              No boosts available at the moment.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
