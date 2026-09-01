'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { addDoc, collection, serverTimestamp, getDoc, doc, query, where, limit, getDocs } from 'firebase/firestore';
import { MessageCircle, Loader2 } from 'lucide-react';

const CYBAZONE_SYSTEM_USERNAME = 'cybazone';

const formSchema = z.object({
  name: z.string().min(2, {
    message: 'Name must be at least 2 characters.',
  }),
  email: z.string().email({
    message: 'Please enter a valid email address.',
  }),
  message: z.string().min(10, {
    message: 'Message must be at least 10 characters.',
  }),
});

export default function ContactPage() {
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const router = useRouter();
  const [messaging, setMessaging] = useState(false);

  const handleMessageUs = async () => {
    if (!user) { router.push('/login?redirect=/contact'); return; }
    setMessaging(true);
    try {
      const sysSnap = await getDocs(query(
        collection(firestore, 'users'),
        where('username_lowercase', '==', CYBAZONE_SYSTEM_USERNAME),
        limit(1),
      ));
      if (sysSnap.empty) {
        toast({ variant: 'destructive', title: 'Direct messaging isn\'t set up yet', description: 'Use the form below instead.' });
        return;
      }
      const sysDoc = sysSnap.docs[0];
      const sysData = sysDoc.data() as any;
      const key = [user.uid, sysDoc.id].sort().join('_');
      const existing = await getDocs(query(collection(firestore, 'conversations'), where('participantKey', '==', key)));
      if (!existing.empty) { router.push(`/messages/${existing.docs[0].id}`); return; }

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
      router.push(`/messages/${convRef.id}`);
    } catch {
      toast({ variant: 'destructive', title: 'Could not open chat', description: 'Please try again.' });
    } finally {
      setMessaging(false);
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      message: '',
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values);
    toast({
      title: 'Message Sent!',
      description: "Thanks for reaching out. We'll get back to you shortly.",
    });
    form.reset();
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg border-primary/20 bg-card/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-widest">
            GET IN TOUCH
          </CardTitle>
          <CardDescription>
            Have a question or a project? Drop us a line.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Button className="w-full" onClick={handleMessageUs} disabled={messaging}>
            {messaging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
            Message Us Directly
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-xs text-muted-foreground">or use the form</span>
            <div className="h-px flex-1 bg-border/50" />
          </div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your Name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="you@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Tell us what's on your mind..."
                        className="min-h-[120px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full">
                Send Message
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
