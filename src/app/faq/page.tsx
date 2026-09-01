'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

type FaqItem = { q: string; a: string };

const DEFAULT_FAQS: FaqItem[] = [
  {
    q: 'What is CYBAZONE?',
    a: 'CYBAZONE is a creator community where creatives and their supporters connect, share, and lift each other up.',
  },
  {
    q: 'What are CYBACoins?',
    a: 'CYBACoins are the in-platform currency you earn by engaging with the community. Use them in the Shop or to Boost content.',
  },
  {
    q: 'How do I earn CYBACoins?',
    a: 'You earn CYBACoins by posting content, supporting other creators, and completing CYBAQuests.',
  },
  {
    q: 'How do Boosts work?',
    a: 'Boosts increase the visibility of a post in the feed, helping creators reach a wider audience.',
  },
  {
    q: 'How do I contact support?',
    a: 'Visit our Contact Us page or reach out through our social media channels.',
  },
];

export default function FAQPage() {
  const { firestore } = useFirebase();

  const faqRef = useMemoFirebase(
    () => doc(firestore, 'settings', 'faq'),
    [firestore]
  );
  const { data, isLoading } = useDoc<{ items: FaqItem[] }>(faqRef);

  const faqs: FaqItem[] = data?.items?.length ? data.items : DEFAULT_FAQS;

  return (
    <main className="container mx-auto max-w-2xl pt-4 pb-16 px-4">
      <h1 className="text-4xl font-bold mb-2">FAQ</h1>
      <p className="text-muted-foreground mb-10">Frequently asked questions about CYBAZONE.</p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {faqs.map((item, i) => (
            <div key={i} className="border border-border rounded-lg p-5">
              <h2 className="font-semibold text-lg mb-2">{item.q}</h2>
              <p className="text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
