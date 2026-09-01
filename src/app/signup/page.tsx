'use client';

import { useForm } from 'react-hook-form';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { initiateEmailSignUp, sendPhoneOtp, confirmPhoneOtp } from '@/firebase/non-blocking-login';
import type { ConfirmationResult } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { doc, collection, query, where, getDocs, updateDoc, setDoc, arrayUnion, type Firestore } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { cn } from '@/lib/utils';

const emailSchema = z.object({
  usernameSuffix: z.string()
    .min(1, { message: 'Enter a name after @CYBA.' })
    .max(20)
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'Letters, numbers, underscores only.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

// New members are auto-followed by these two official accounts so their feed isn't empty
// on day one. Looked up by username (not hardcoded uid) since those accounts' uids vary
// per environment.
const AUTO_FOLLOW_USERNAMES = ['cybazone', 'cybasuess'];

async function autoFollowSystemAccounts(firestore: Firestore, newUserId: string) {
  try {
    const snap = await getDocs(query(
      collection(firestore, 'users'),
      where('username_lowercase', 'in', AUTO_FOLLOW_USERNAMES),
    ));
    const systemIds = snap.docs.map(d => d.id).filter(id => id !== newUserId);
    await Promise.all(systemIds.map(id => updateDoc(doc(firestore, 'users', id), { followers: arrayUnion(newUserId) })));
    if (systemIds.length > 0) {
      // setDoc+merge (not updateDoc) — the new user's own doc write above is fire-and-forget,
      // so it may not exist yet; merge creates it safely either way.
      await setDoc(doc(firestore, 'users', newUserId), { following: arrayUnion(...systemIds) }, { merge: true });
    }
  } catch {
    // Non-critical — never block signup on this
  }
}

async function applyReferral(newUserId: string, referrerUsername: string) {
  try {
    await fetch('/api/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newUserId, referrerUsername }),
    });
  } catch {
    // Non-critical — referral bonus can fail silently
  }
}

export default function SignupPage() {
  const { firestore, auth, user } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  const [phone, setPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [phoneUsernameSuffix, setPhoneUsernameSuffix] = useState('');
  const recaptchaRef = useRef<HTMLDivElement>(null);

  // Payout state (shared across both tabs)
  const [payoutPlatform, setPayoutPlatform] = useState<'cashapp' | 'venmo'>('cashapp');
  const [payoutUsername, setPayoutUsername] = useState('');

  // Referral state (shared)
  const [referredBy, setReferredBy] = useState('');

  // Legal consent — required before either signup path can proceed
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const hasConsented = agreedTerms && agreedPrivacy;

  const emailForm = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { usernameSuffix: '', email: '', password: '' },
  });

  async function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    if (!hasConsented) {
      toast({ variant: 'destructive', title: 'Please agree to the Terms & Agreements and Privacy Policy first.' });
      return;
    }
    initiateEmailSignUp(auth, values.email, values.password);
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const { usernameSuffix, email } = emailForm.getValues();
        if (usernameSuffix && email) {
          const username = 'CYBA' + usernameSuffix.trim();
          const userRef = doc(firestore, 'users', firebaseUser.uid);
          const userData: Record<string, any> = {
            id: firebaseUser.uid,
            username,
            username_lowercase: username.toLowerCase(),
            email,
            cybaCoinBalance: 0,
          };
          if (payoutUsername.trim()) {
            userData.payoutPlatform = payoutPlatform;
            userData.payoutUsername = payoutUsername.trim().replace(/^[@$]/, '');
          }
          setDocumentNonBlocking(userRef, userData, { merge: true });
          await autoFollowSystemAccounts(firestore, firebaseUser.uid);

          if (referredBy.trim()) {
            await applyReferral(firebaseUser.uid, referredBy.trim());
          }

          router.push('/');
        }
      }
    });
    return () => unsubscribe();
  }, [auth, firestore, emailForm, router, referredBy, payoutPlatform, payoutUsername]);

  const handleSendOtp = async () => {
    if (!hasConsented) {
      toast({ variant: 'destructive', title: 'Please agree to the Terms & Agreements and Privacy Policy first.' });
      return;
    }
    if (!phoneUsernameSuffix.trim()) {
      toast({ variant: 'destructive', title: 'Username required', description: 'Enter a name after @CYBA before continuing.' });
      return;
    }
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(phoneUsernameSuffix.trim())) {
      toast({ variant: 'destructive', title: 'Invalid username', description: 'Letters, numbers, underscores only (1–20 chars).' });
      return;
    }
    if (!phone || !isValidPhoneNumber(phone)) {
      toast({ variant: 'destructive', title: 'Invalid number', description: 'Please enter a valid phone number with country code.' });
      return;
    }
    setIsSendingOtp(true);
    const result = await sendPhoneOtp(auth, phone, 'recaptcha-container-signup');
    setIsSendingOtp(false);
    if (result) {
      setConfirmation(result);
      toast({ title: 'Code sent!', description: 'Check your messages for the 6-digit code.' });
    }
  };

  const handleConfirmOtp = async () => {
    if (!confirmation || otpCode.length < 6) return;
    setIsConfirming(true);
    const cred = await confirmPhoneOtp(confirmation, otpCode);
    setIsConfirming(false);
    if (cred) {
      const userRef = doc(firestore, 'users', cred.user.uid);
      const phoneUsername = 'CYBA' + phoneUsernameSuffix.trim();
      const phoneUserData: Record<string, any> = {
        id: cred.user.uid,
        username: phoneUsername,
        username_lowercase: phoneUsername.toLowerCase(),
        phone,
        cybaCoinBalance: 0,
      };
      if (payoutUsername.trim()) {
        phoneUserData.payoutPlatform = payoutPlatform;
        phoneUserData.payoutUsername = payoutUsername.trim().replace(/^[@$]/, '');
      }
      setDocumentNonBlocking(userRef, phoneUserData, { merge: true });
      await autoFollowSystemAccounts(firestore, cred.user.uid);

      if (referredBy.trim()) {
        await applyReferral(cred.user.uid, referredBy.trim());
      }

      router.push('/');
    }
  };

  const ReferralField = (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-muted-foreground">
        Referred By <span className="text-xs font-normal">(Optional)</span>
      </label>
      <div className="flex items-center rounded-md border border-input overflow-hidden">
        <span className="bg-muted px-3 py-2 text-sm font-bold text-primary border-r border-input shrink-0 select-none">@CYBA</span>
        <input
          value={referredBy}
          onChange={(e) => setReferredBy(e.target.value)}
          maxLength={24}
          placeholder="FriendName"
          className="flex-1 bg-background px-3 py-2 text-sm focus:outline-none"
        />
      </div>
      <p className="text-[11px] text-muted-foreground">You and your referrer each get 1,000 CYBACOIN.</p>
    </div>
  );

  const PayoutField = (
    <div className="space-y-2">
      <label className="text-sm font-medium text-muted-foreground">
        Payout Boost Account <span className="text-xs font-normal">(Optional)</span>
      </label>
      <div className="flex rounded-lg overflow-hidden border border-input">
        {(['cashapp', 'venmo'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPayoutPlatform(p)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium transition-colors',
              payoutPlatform === p
                ? p === 'cashapp' ? 'bg-[#00C244] text-white' : 'bg-[#3D95CE] text-white'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
          >
            {p === 'cashapp' ? '$ Cash App' : '🅥 Venmo'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm shrink-0">
          {payoutPlatform === 'cashapp' ? '$' : '@'}
        </span>
        <input
          value={payoutUsername}
          onChange={(e) => setPayoutUsername(e.target.value)}
          maxLength={50}
          placeholder={payoutPlatform === 'cashapp' ? 'YourCashtag' : 'YourVenmo'}
          className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>
  );

  const TermsField = (
    <div className="space-y-2 rounded-lg border border-input p-3">
      <label className="flex items-start gap-2.5 cursor-pointer">
        <Checkbox checked={agreedTerms} onCheckedChange={c => setAgreedTerms(c === true)} className="mt-0.5" />
        <span className="text-xs text-muted-foreground">
          I agree to the <Link href="/terms" target="_blank" className="underline text-primary">Terms &amp; Agreements</Link>
        </span>
      </label>
      <label className="flex items-start gap-2.5 cursor-pointer">
        <Checkbox checked={agreedPrivacy} onCheckedChange={c => setAgreedPrivacy(c === true)} className="mt-0.5" />
        <span className="text-xs text-muted-foreground">
          I agree to the <Link href="/privacy" target="_blank" className="underline text-primary">Privacy Policy</Link>
        </span>
      </label>
    </div>
  );

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      <div id="recaptcha-container-signup" ref={recaptchaRef} />

      <Card className="w-full max-w-md border-primary/20 bg-card/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-widest">CREATE ACCOUNT</CardTitle>
          <CardDescription>Join CYBAZONE for free.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-6">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            {/* ── Email tab ── */}
            <TabsContent value="email">
              <Form {...emailForm}>
                <form onSubmit={emailForm.handleSubmit(onEmailSubmit)} className="space-y-4">
                  <FormField
                    control={emailForm.control}
                    name="usernameSuffix"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <div className="flex items-center rounded-md border border-input overflow-hidden">
                            <span className="bg-muted px-3 py-2 text-sm font-bold text-primary border-r border-input shrink-0 select-none">@CYBA</span>
                            <input
                              {...field}
                              maxLength={20}
                              placeholder="YourName"
                              autoComplete="username"
                              className="flex-1 bg-background px-3 py-2 text-sm focus:outline-none"
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@email.com" {...field} autoComplete="email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={emailForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} autoComplete="new-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {ReferralField}
                  {PayoutField}
                  {TermsField}
                  <Button type="submit" className="w-full" disabled={!hasConsented}>Create Account</Button>
                </form>
              </Form>
            </TabsContent>

            {/* ── Phone tab ── */}
            <TabsContent value="phone">
              <div className="space-y-4">
                {!confirmation ? (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Username</label>
                      <div className="flex items-center rounded-md border border-input overflow-hidden">
                        <span className="bg-muted px-3 py-2 text-sm font-bold text-primary border-r border-input shrink-0 select-none">@CYBA</span>
                        <input
                          value={phoneUsernameSuffix}
                          onChange={(e) => setPhoneUsernameSuffix(e.target.value)}
                          maxLength={20}
                          placeholder="YourName"
                          autoComplete="username"
                          className="flex-1 bg-background px-3 py-2 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Phone Number</label>
                      <PhoneInput
                        international
                        defaultCountry="US"
                        value={phone}
                        onChange={(val) => setPhone(val ?? '')}
                        className="phone-input-field"
                      />
                    </div>
                    {ReferralField}
                    {PayoutField}
                    {TermsField}
                    <Button onClick={handleSendOtp} disabled={isSendingOtp || !hasConsented} className="w-full">
                      {isSendingOtp ? 'Sending…' : 'Send Verification Code'}
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">6-Digit Code</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                        className="text-center text-xl tracking-widest"
                        autoFocus
                      />
                      <p className="text-xs text-muted-foreground text-center">
                        Sent to {phone}.{' '}
                        <button onClick={() => setConfirmation(null)} className="underline hover:text-primary">
                          Change
                        </button>
                      </p>
                    </div>
                    <Button onClick={handleConfirmOtp} disabled={isConfirming || otpCode.length < 6} className="w-full">
                      {isConfirming ? 'Verifying…' : 'Verify & Create Account'}
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            Already have an account?{' '}
            <Link href="/login" className="underline text-primary">Sign in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
