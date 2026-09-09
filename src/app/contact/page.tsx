'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, getDoc, doc, query, where, limit, getDocs } from 'firebase/firestore';
import { MessageCircle, Loader2 } from 'lucide-react';
import type { KeywordResponder } from '@/lib/keyword-responders';

const CYBAZONE_SYSTEM_USERNAME = 'cybazone';

export default function ContactPage() {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const router = useRouter();
  const [messaging, setMessaging] = useState<string | null>(null);

  // Quick-topic chips are sourced from the admin-configured keyword auto-responders, so tapping
  // one and hitting send in the thread triggers the exact same automated reply an admin set up.
  const respondersRef = useMemoFirebase(() => doc(firestore, 'settings', 'keywordResponders'), [firestore]);
  const { data: responderConfig } = useDoc<{ responders?: KeywordResponder[] }>(respondersRef);
  const topics = (responderConfig?.responders ?? []).filter(r => r.keyword.trim());

  const handleMessageUs = async (prefill?: string) => {
    if (!user) { router.push('/login?redirect=/contact'); return; }
    setMessaging(prefill ?? 'general');
    try {
      const sysSnap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '==', CYBAZONE_SYSTEM_USERNAME),
        limit(1),
      ));
      if (sysSnap.empty) {
        toast({ variant: 'destructive', title: 'Direct messaging isn\'t set up yet', description: 'Please try again later.' });
        return;
      }
      const sysDoc = sysSnap.docs[0];
      const sysData = sysDoc.data() as any;
      const key = [user.uid, sysDoc.id].sort().join('_');
      const existing = await getDocs(query(collection(firestore, 'conversations'), where('participantKey', '==', key)));

      let convId: string;
      if (!existing.empty) {
        convId = existing.docs[0].id;
      } else {
        const mySnap = await getDoc(doc(firestore, 'users', user.uid));
        const myData = mySnap.data() as any;
        const convRef = await addDoc(collection(firestore, 'conversations'), {
          type: 'direct',
          participants: [user.uid, sysDoc.id],
          participantInfo: {
            [user.uid]: { username: myData?.username ?? 'Me', profilePictureUrl: myData?.profilePictureUrl ?? null, avatarConfig: myData?.avatarConfig ?? null },
            [sysDoc.id]: { username: sysData?.username ?? 'CYBAZONE', profilePictureUrl: sysData?.profilePictureUrl ?? null, avatarConfig: sysData?.avatarConfig ?? null },
          },
          participantKey: key,
          unreadCounts: { [user.uid]: 0, [sysDoc.id]: 0 },
          createdAt: serverTimestamp(),
          createdBy: user.uid,
          lastMessageAt: serverTimestamp(),
          lastMessage: '',
          name: null,
        });
        convId = convRef.id;
      }
      router.push(prefill ? `/messages/${convId}?prefill=${encodeURIComponent(prefill)}` : `/messages/${convId}`);
    } catch {
      toast({ variant: 'destructive', title: 'Could not open chat', description: 'Please try again.' });
    } finally {
      setMessaging(null);
    }
  };

  return (
    <div className="container mx-auto flex flex-col min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg border-primary/20 bg-card/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-widest">
            HELP & SUPPORT
          </CardTitle>
          <CardDescription>
            Have a question? Message CYBAZONE support directly — we typically reply fast, and some topics get an instant automated answer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {topics.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 uppercase tracking-widest">Quick Topics</p>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <Button
                    key={t.keyword}
                    variant="outline"
                    size="sm"
                    disabled={!!messaging}
                    onClick={() => handleMessageUs(t.keyword)}
                    className="rounded-full"
                  >
                    {messaging === t.keyword ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                    {t.keyword}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <Button className="w-full" onClick={() => handleMessageUs()} disabled={!!messaging}>
            {messaging === 'general' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            Message CYBAZONE Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
