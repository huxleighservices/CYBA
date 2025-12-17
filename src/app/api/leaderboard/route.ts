
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// --- Firebase Admin Initialization ---
let adminApp: App;
let db: Firestore;

// This improved pattern ensures we initialize the app only once in a serverless environment.
if (!getApps().length) {
  // When running on App Hosting, GOOGLE_APPLICATION_CREDENTIALS is not set.
  // initializeApp() with no arguments will automatically use Application Default Credentials.
  // In a local or other environment, you might need service account credentials.
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

  if (!authToken || authToken !== expectedToken) {
    console.warn('Unauthorized request received.');
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  // 2. Process the incoming data
  try {
    const rawData = await request.json();

    // Make works with "bundles". The Array Aggregator should send an array.
    // We'll double-check it's an array.
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return new NextResponse(JSON.stringify({ message: 'Request body must be an array of leaderboard entries.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const leaderboardCollection = db.collection('leaderboard');
    const batch = db.batch();
    const processedNames = new Set();

    // 3. Prepare to write to Firestore
    for (const entry of rawData) {
        // Data from "Search Rows" can have keys as header names (e.g., 'cybaName')
        // or as column letters ('A', 'B') if headers are off. We will handle both.
        // We'll also handle the numeric keys from the aggregator ('0', '1', etc).
        const cybaName = entry.cybaName || entry.A || entry['0'];
        
        // Use cybaName as the basis for the document ID for easy updates.
        // Ensure cybaName is a clean, valid string for a document ID.
        if (!cybaName || typeof cybaName !== 'string') {
            console.warn('Skipping entry with missing or invalid cybaName:', entry);
            continue; // Skip entries without a valid name
        }
        
        // Sanitize the name to create a Firestore-safe document ID
        const docId = cybaName.trim().replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();

        if (!docId || processedNames.has(docId)) {
            console.warn('Skipping entry - generated docId is empty or a duplicate:', cybaName);
            continue;
        }
        processedNames.add(docId);

        const docRef = leaderboardCollection.doc(docId);

        // Map data, checking for all possible key formats from Make.com
        const dataToSave = {
            cybaName: cybaName,
            cybaIg: entry.cybaIg || entry.B || entry['1'] || '',
            tier: entry.tier || entry.C || entry['2'] || '',
            outwardEngagement: Number(entry.outwardEngagement || entry.D || entry['3'] || 0),
            inwardEngagement: Number(entry.inwardEngagement || entry.E || entry['4'] || 0),
            features: Number(entry.features || entry.F || entry['5'] || 0),
            cybaCoin: Number(entry.cybaCoin || entry.G || entry['6'] || 0),
        };
        
        // Use set with merge to create or update the document.
        batch.set(docRef, dataToSave, { merge: true });
    }

    // 4. Commit the batch write
    if (processedNames.size === 0) {
        return new NextResponse(JSON.stringify({ message: 'No valid entries to process.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    await batch.commit();

    return new NextResponse(JSON.stringify({ message: `Leaderboard updated successfully with ${processedNames.size} entries.` }), {
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
