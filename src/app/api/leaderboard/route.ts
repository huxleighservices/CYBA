
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// --- Firebase Admin Initialization ---
let adminApp: App;
let db: Firestore;

// This pattern ensures we initialize the app only once in a serverless environment
if (!getApps().length) {
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
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 2. Process the incoming data
  try {
    const rawData = await request.json();

    // Make works with "bundles". If it sends one row, it's an object.
    // If it sends multiple (especially after an aggregator), it's an array of objects. We'll handle both.
    const data = Array.isArray(rawData) ? rawData : [rawData];

    if (data.length === 0) {
        return new NextResponse(JSON.stringify({ message: 'Request body was empty or not an array.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const leaderboardCollection = db.collection('leaderboard');
    const batch = db.batch();

    // 3. Prepare to write to Firestore
    for (const entry of data) {
        // Data from "Search Rows" often uses column letters or numbers as keys.
        // We'll check for headers (A, B, C), numeric keys (0, 1, 2), and named keys.
        const cybaName = entry.A || entry.cybaName || entry['0'];
        
        // Use cybaName as the document ID for easy updates.
        // Ensure cybaName is a clean, valid string for a document ID.
        if (!cybaName || typeof cybaName !== 'string') {
            console.warn('Skipping entry with missing or invalid cybaName:', entry);
            continue; // Skip entries without a valid name
        }
        
        const docId = cybaName.trim().replace(/[.\s#$/[\]]/g, '-').toLowerCase();

        if (!docId) {
            console.warn('Skipping entry - generated docId is empty from cybaName:', cybaName);
            continue;
        }


        const docRef = leaderboardCollection.doc(docId);

        const dataToSave = {
            cybaName: cybaName,
            cybaIg: entry.B || entry.cybaIg || entry['1'] || '',
            tier: entry.C || entry.tier || entry['2'] || '',
            outwardEngagement: Number(entry.D || entry.outwardEngagement || entry['3'] || 0),
            inwardEngagement: Number(entry.E || entry.inwardEngagement || entry['4'] || 0),
            features: Number(entry.F || entry.features || entry['5'] || 0),
            cybaCoin: Number(entry.G || entry.cybaCoin || entry['6'] || 0),
        };

        // Use set with merge to create or update the document.
        batch.set(docRef, dataToSave, { merge: true });
    }

    // 4. Commit the batch write
    await batch.commit();

    return new NextResponse(JSON.stringify({ message: `Leaderboard updated successfully with ${data.length} entries.` }), {
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
