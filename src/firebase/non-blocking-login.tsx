'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
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
    case 'auth/invalid-phone-number':
    case 'auth/missing-phone-number':
      title = 'Invalid Phone Number';
      description = 'Please enter a valid phone number with country code (e.g. +1 234 567 8900).';
      break;
    case 'auth/too-many-requests':
      title = 'Too Many Attempts';
      description = 'Too many requests. Please wait a few minutes and try again.';
      break;
    case 'auth/captcha-check-failed':
    case 'auth/missing-verification-code':
      title = 'reCAPTCHA Failed';
      description = 'Security check failed. Please refresh the page and try again.';
      break;
    case 'auth/code-expired':
    case 'auth/invalid-verification-code':
      title = 'Invalid Code';
      description = 'The verification code is incorrect or has expired. Please request a new one.';
      break;
    case 'auth/quota-exceeded':
      title = 'SMS Quota Exceeded';
      description = 'SMS quota exceeded. Please try again later or use email login.';
      break;
    case 'auth/operation-not-allowed':
      title = 'Phone Auth Disabled';
      description = 'Phone number sign-in is not enabled. Please use email login.';
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

/** Set up an invisible reCAPTCHA and send an SMS code to phoneNumber (e.g. "+14155552671"). */
export async function sendPhoneOtp(
  authInstance: Auth,
  phoneNumber: string,
  recaptchaContainerId: string
): Promise<ConfirmationResult | null> {
  try {
    // Clear any previous verifier and reset the container
    if ((window as any)._recaptchaVerifier) {
      try { (window as any)._recaptchaVerifier.clear(); } catch {}
      (window as any)._recaptchaVerifier = null;
    }
    // Reset the container element so reCAPTCHA can re-render into it
    const container = document.getElementById(recaptchaContainerId);
    if (container) container.innerHTML = '';

    const verifier = new RecaptchaVerifier(authInstance, recaptchaContainerId, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => {
        toast({ variant: 'destructive', title: 'reCAPTCHA expired', description: 'Please try sending the code again.' });
      },
    });
    (window as any)._recaptchaVerifier = verifier;
    await verifier.render();
    const result = await signInWithPhoneNumber(authInstance, phoneNumber, verifier);
    return result;
  } catch (err: any) {
    // Clean up on failure so next attempt gets a fresh verifier
    if ((window as any)._recaptchaVerifier) {
      try { (window as any)._recaptchaVerifier.clear(); } catch {}
      (window as any)._recaptchaVerifier = null;
    }
    handleAuthError(err);
    return null;
  }
}

/** Confirm the OTP code. Returns the UserCredential or null on failure. */
export async function confirmPhoneOtp(
  confirmation: ConfirmationResult,
  code: string
) {
  try {
    return await confirmation.confirm(code);
  } catch (err: any) {
    toast({
      variant: 'destructive',
      title: 'Invalid Code',
      description: 'The verification code was incorrect or has expired.',
    });
    return null;
  }
}
