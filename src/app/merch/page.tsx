import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { ShoppingCart } from 'lucide-react';

const products = [
  {
    id: 'merch-hoodie',
    name: 'CYBA Galaxy Hoodie',
    price: '$65.00',
  },
  {
    id: 'merch-cap',
    name: 'RetroWave Cap',
    price: '$25.00',
  },
  {
    id: 'merch-tshirt',
    name: '80s Glitch Tee',
    price: '$30.00',
  },
  {
    id: 'merch-hoodie-2',
    name: 'CYBA Classic Hoodie',
    price: '$65.00',
    imageHint: 'black hoodie',
    imageUrl: 'https://picsum.photos/seed/cyba-hoodie-2/600/600',
  },
  {
    id: 'merch-cap-2',
    name: 'Synthwave Cap',
    price: '$25.00',
    imageHint: 'black cap',
    imageUrl: 'https://picsum.photos/seed/cyba-cap-2/600/600',
  },
  {
    id: 'merch-tshirt-2',
    name: 'Neon Grid Tee',
    price: '$30.00',
    imageHint: 'graphic t-shirt',
    imageUrl: 'https://picsum.photos/seed/cyba-tshirt-2/600/600',
  },
];

export default function MerchPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          CYBA Merch
        </h1>
        <p className="text-lg text-foreground/80 mb-12">
          Wear the vibe. Official gear from the CYBA Galaxy, designed for
          creators and fans.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {products.map((product) => {
          const image = PlaceHolderImages.find((p) => p.id === product.id);
          const imageUrl = image ? image.imageUrl : product.imageUrl;
          const imageHint = image ? image.imageHint : product.imageHint;

          return (
            <Card
              key={product.id}
              className="overflow-hidden group border-primary/20 bg-card/50"
            >
              <CardHeader className="p-0">
                <div className="aspect-square overflow-hidden">
                  <Image
                    src={imageUrl!}
                    alt={product.name}
                    width={600}
                    height={600}
                    className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-110"
                    data-ai-hint={imageHint}
                  />
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <CardTitle className="text-lg font-semibold">
                  {product.name}
                </CardTitle>
                <p className="text-primary font-bold mt-1">{product.price}</p>
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button className="w-full group/btn">
                  <ShoppingCart className="h-4 w-4 mr-2 group-hover/btn:animate-pulse" />{' '}
                  Add to Cart
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
