'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

// Non-critical collections — permission errors here should never crash the app
const SILENT_PATHS = ['conversations', 'notifications'];

/**
 * Listens for globally emitted 'permission-error' events.
 * Silently ignores errors on non-critical collections (messages, notifications)
 * so a missing Firestore rule doesn't take down the entire UI.
 */
export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      const isSilent = SILENT_PATHS.some(p => error.message?.includes(p));
      if (!isSilent) {
        // Only log to console — do NOT throw, which would crash the whole app
        console.error('[Firestore permission error]', error.message);
      }
      // Permission errors on non-critical paths are ignored entirely
    };

    errorEmitter.on('permission-error', handleError);
    return () => errorEmitter.off('permission-error', handleError);
  }, []);

  return null;
}
