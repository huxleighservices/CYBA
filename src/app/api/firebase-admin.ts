import { initializeApp, getApps, getApp, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

function initializeFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  return initializeApp({
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminApp = initializeFirebaseAdmin();

export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
