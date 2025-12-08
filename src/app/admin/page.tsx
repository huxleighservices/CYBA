'use client';

import { useState } from 'react';
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
import { Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const passwordSchema = z.object({
  password: z.string().min(1, 'Password is required.'),
});

const ADMIN_PASSWORD = 'VIOLETCYBA';

function PasswordForm({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
    },
  });

  function onSubmit(values: z.infer<typeof passwordSchema>) {
    if (values.password === ADMIN_PASSWORD) {
      onSuccess();
    } else {
      toast({
        variant: 'destructive',
        title: 'Incorrect Password',
        description: 'Please try again.',
      });
      form.reset();
    }
  }

  return (
    <Card className="w-full max-w-md border-primary/20 bg-card/50">
      <CardHeader className="text-center">
        <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit">
          <Shield className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold tracking-widest mt-4">
          Admin Access
        </CardTitle>
        <CardDescription>
          This page requires authentication.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="••••••••"
                      {...field}
                      autoComplete="current-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full">
              Authenticate
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function AdminPanel() {
  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center max-w-3xl mx-auto">
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-glow mb-4">
          Admin Panel
        </h1>
        <p className="text-lg text-foreground/80">
          Welcome to the admin dashboard.
        </p>
      </div>
      {/* Admin content goes here */}
    </div>
  );
}

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16">
        <PasswordForm onSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return <AdminPanel />;
}
