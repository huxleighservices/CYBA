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
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

export default function MerchPage() {
  const { firestore } = useFirebase();
  const merchRef = useMemoFirebase(
    () => collection(firestore, 'merchandise'),
    [firestore]
  );
  const { data: merchandise, isLoading } = useCollection(merchRef);

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBA Merch
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Exclusive gear from the CYBA family.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : merchandise && merchandise.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {merchandise.map((item) => (
            <Card
              key={item.id}
              className="flex flex-col overflow-hidden border-primary/20 bg-card/50"
            >
              <CardHeader className="p-0">
                <div className="aspect-square relative">
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-6 flex-grow">
                <CardTitle className="font-headline text-xl mb-2">
                  {item.name}
                </CardTitle>
                <CardDescription className="text-foreground/70 mb-4">
                  {item.description}
                </CardDescription>
              </CardContent>
              <CardFooter className="p-6 pt-0 flex justify-between items-center">
                <p className="text-2xl font-bold text-primary">
                  ${item.price.toFixed(2)}
                </p>
                <Button asChild>
                  <Link href={item.buyNowUrl} target="_blank">
                    Buy Now
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center text-foreground/60">
          <p>Merch store is currently empty. Please check back soon!</p>
        </div>
      )}
    </div>
  );
}
