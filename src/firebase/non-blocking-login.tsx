'use client';
import {
  Auth, // Import Auth type for type hinting
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { toast } from '@/hooks/use-toast';

function handleAuthError(error: any) {
  let title = 'Authentication Error';
  let description = 'An unexpected error occurred. Please try again.';

  switch (error.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      title = 'Sign-In Failed';
      description = 'The email or password you entered is incorrect.';
      break;
    case 'auth/user-not-found':
      title = 'Sign-In Failed';
      description = 'No account found with this email address.';
      break;
    case 'auth/email-already-in-use':
      title = 'Sign-Up Failed';
      description = 'This email address is already registered.';
      break;
    case 'auth/weak-password':
      title = 'Sign-Up Failed';
      description = 'The password is too weak. Please use at least 6 characters.';
      break;
    case 'auth/invalid-email':
        title = 'Invalid Email';
        description = 'Please enter a valid email address.';
        break;
    default:
      console.error('Unhandled Auth Error:', error);
      break;
  }

  toast({
    variant: 'destructive',
    title: title,
    description: description,
  });
}


/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  signInAnonymously(authInstance)
    .catch(handleAuthError);
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  createUserWithEmailAndPassword(authInstance, email, password)
    .catch(handleAuthError);
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .catch(handleAuthError);
}
