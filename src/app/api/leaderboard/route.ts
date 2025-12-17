
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// IMPORTANT: Do not use client-side Firebase libraries in server-side code.
// Use firebase-admin instead.

// --- Firebase Admin Initialization ---
// This ensures we have a single instance of the Firebase Admin SDK.
let adminApp: App;
let db: Firestore;

if (!getApps().length) {
  // In a deployed Vercel/Firebase Hosting environment, GOOGLE_APPLICATION_CREDENTIALS
  // are automatically set up. In local development, you need to set this
  // environment variable to point to your service account key file.
  adminApp = initializeApp();
} else {
  adminApp = getApps()[0];
}
db = getFirestore(adminApp);


// --- API Endpoint ---

export async function POST(request: Request) {
  // 1. Secure the endpoint
  const authToken = request.headers.get('Authorization');
  const expectedToken = `Bearer ${process.env.LEADERBOARD_API_SECRET}`;

  if (authToken !== expectedToken) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Process the incoming data
  try {
    const data = await request.json();

    // Expect data to be an array of leaderboard entries from Make.com
    if (!Array.isArray(data)) {
        return new NextResponse(JSON.stringify({ message: 'Request body must be an array of leaderboard entries.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const leaderboardCollection = db.collection('leaderboard');
    const batch = db.batch();

    // 3. Prepare to write to Firestore
    for (const entry of data) {
        // Use cybaName as the document ID for easy updates.
        // Ensure cybaName is a clean, valid string for a document ID.
        const docId = entry.cybaName?.toString().replace(/\s+/g, '-').toLowerCase();

        if (!docId) {
            console.warn('Skipping entry with missing cybaName:', entry);
            continue; // Skip entries without a valid name
        }

        const docRef = leaderboardCollection.doc(docId);

        const dataToSave = {
            cybaName: entry.cybaName || '',
            cybaIg: entry.cybaIg || '',
            tier: entry.tier || '',
            outwardEngagement: Number(entry.outwardEngagement) || 0,
            inwardEngagement: Number(entry.inwardEngagement) || 0,
            features: Number(entry.features) || 0,
            cybaCoin: Number(entry.cybaCoin) || 0,
        };

        // Use set with merge to create or update the document.
        batch.set(docRef, dataToSave, { merge: true });
    }

    // 4. Commit the batch write
    await batch.commit();

    return new NextResponse(JSON.stringify({ message: 'Leaderboard updated successfully.' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error processing leaderboard update:', error);
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
    });
  }
}
