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

export default function MembershipPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div className="max-w-md">
        <Card className="flex flex-col border-primary/20 bg-card/50 transition-all duration-300 hover:border-primary">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl font-bold tracking-widest">
              GALAXY
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
      </div>
    </div>
  );
}
