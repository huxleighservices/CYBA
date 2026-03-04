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
import { collection, orderBy, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';

export default function ShopPage() {
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const merchRef = useMemoFirebase(
    () => query(collection(firestore, 'merchandise'), orderBy('name')),
    [firestore]
  );
  const { data: merchandise, isLoading: isLoadingMerch } =
    useCollection(merchRef);

  const handleCybacoinPurchase = () => {
    toast({
      title: 'Coming Soon!',
      description: 'CYBACOIN checkout is not yet implemented.',
    });
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          SHOP
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Exclusive gear from the CYBAZONE
        </p>
      </div>

      {isLoadingMerch ? (
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
              <CardFooter className="p-6 pt-0 flex-col items-stretch space-y-4">
                <div className="flex justify-between items-center">
                  <p className="text-2xl font-bold text-primary">
                    ${item.price.toFixed(2)}
                  </p>
                  <Button asChild>
                    <Link href={item.buyNowUrl} target="_blank">
                      Buy Now
                    </Link>
                  </Button>
                </div>

                {item.cybaCoinPrice > 0 && (
                  <div className="flex justify-between items-center border-t border-primary/20 pt-4">
                    <div className="flex items-center gap-2">
                      <Image
                        src="/CCoin.png?v=2"
                        alt="CYBACOIN"
                        width={37}
                        height={37}
                      />
                      <p className="text-2xl font-bold text-primary">
                        {item.cybaCoinPrice}
                      </p>
                    </div>
                    <Button onClick={handleCybacoinPurchase}>
                      Buy with CYBACOIN
                    </Button>
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center text-foreground/60">
          <p>Shop is currently empty. Please check back soon!</p>
        </div>
      )}
    </div>
  );
}
