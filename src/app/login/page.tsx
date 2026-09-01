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
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { initiateEmailSignIn, sendPhoneOtp, confirmPhoneOtp } from '@/firebase/non-blocking-login';
import { sendPasswordResetEmail } from 'firebase/auth';
import type { ConfirmationResult } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

const emailSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters.' }),
});

export default function LoginPage() {
  const { auth, user } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  // Email/password state
  const [resetEmail, setResetEmail] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [isSendingReset, setIsSendingReset] = useState(false);

  // Phone state
  const [phone, setPhone] = useState<string>('');
  const [otpCode, setOtpCode] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const recaptchaRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof emailSchema>>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '', password: '' },
  });

  function onEmailSubmit(values: z.infer<typeof emailSchema>) {
    initiateEmailSignIn(auth, values.email, values.password);
  }

  const handleSendOtp = async () => {
    if (!phone || !isValidPhoneNumber(phone)) {
      toast({ variant: 'destructive', title: 'Invalid number', description: 'Please enter a valid phone number with country code.' });
      return;
    }
    setIsSendingOtp(true);
    const result = await sendPhoneOtp(auth, phone, 'recaptcha-container');
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
    if (cred) router.push('/');
  };

  const handlePasswordReset = async () => {
    const email = resetEmail.trim() || form.getValues('email').trim();
    if (!email) {
      toast({ variant: 'destructive', title: 'Enter your email first' });
      return;
    }
    setIsSendingReset(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast({ title: 'Reset email sent!', description: `Check ${email} for a reset link.` });
      setShowReset(false);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Could not send reset email', description: err?.message });
    } finally {
      setIsSendingReset(false);
    }
  };

  useEffect(() => {
    if (user) router.push('/');
  }, [user, router]);

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
      {/* Invisible reCAPTCHA mount point */}
      <div id="recaptcha-container" ref={recaptchaRef} />

      <Card className="w-full max-w-md border-primary/20 bg-card/50">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold tracking-widest">SIGN IN</CardTitle>
          <CardDescription>Access your CYBAZONE account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="email" className="w-full">
            <TabsList className="w-full grid grid-cols-2 mb-6">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="phone">Phone</TabsTrigger>
            </TabsList>

            {/* ── Email tab ── */}
            <TabsContent value="email">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onEmailSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
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
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} autoComplete="current-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">Sign In</Button>
                  <button
                    type="button"
                    onClick={() => setShowReset(true)}
                    className="w-full text-xs text-muted-foreground hover:text-primary transition-colors text-center"
                  >
                    Forgot your password?
                  </button>
                </form>
              </Form>

              {showReset && (
                <div className="mt-4 p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
                  <p className="text-sm font-medium">Reset your password</p>
                  <input
                    type="email"
                    value={resetEmail || form.getValues('email')}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handlePasswordReset} disabled={isSendingReset} className="flex-1">
                      {isSendingReset ? 'Sending…' : 'Send Reset Email'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowReset(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ── Phone tab ── */}
            <TabsContent value="phone">
              <div className="space-y-4">
                {!confirmation ? (
                  <>
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
                    <Button onClick={handleSendOtp} disabled={isSendingOtp} className="w-full">
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
                      {isConfirming ? 'Verifying…' : 'Verify & Sign In'}
                    </Button>
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="underline text-primary">Sign up</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
