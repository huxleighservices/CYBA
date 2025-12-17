
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// --- Firebase Admin Initialization ---
// This pattern is crucial for serverless environments like App Hosting.
function getFirebaseAdmin() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // When deployed, App Hosting provides GOOGLE_APPLICATION_CREDENTIALS.
  // For local dev, you can set FIREBASE_SERVICE_ACCOUNT_KEY in .env.local
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({ credential: cert(serviceAccount) });
    } catch (e) {
      console.error("Error initializing Firebase Admin with service account key:", e);
      return null;
    }
  }

  // Default for deployed environments.
  return initializeApp();
}

// --- Helper to delete all documents in a collection ---
async function deleteCollection(db: Firestore, collectionPath: string, batchSize: number = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    return new Promise<void>((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: Firestore, query: FirebaseFirestore.Query, resolve: () => void) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
        return resolve();
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

// --- API Endpoint ---
export async function POST(request: Request) {
  // 1. Secure the endpoint
  const authToken = request.headers.get('Authorization');
  const expectedToken = `Bearer ${process.env.LEADERBOARD_API_SECRET}`;

  if (!process.env.LEADERBOARD_API_SECRET) {
      console.error('LEADERBOARD_API_SECRET is not set on the server.');
      return new NextResponse(JSON.stringify({ message: 'Internal Server Error: Server is not configured correctly.' }), { status: 500 });
  }

  if (!authToken || authToken !== expectedToken) {
    console.warn('Unauthorized access attempt to /api/leaderboard');
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  // 2. Initialize Firebase Admin
  const adminApp = getFirebaseAdmin();
  if (!adminApp) {
    console.error('Failed to initialize Firebase Admin SDK.');
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error: Database connection failed.' }), { status: 500 });
  }
  const db = getFirestore(adminApp);

  try {
    // 3. Process incoming data
    const rawData = await request.json();
    if (!Array.isArray(rawData)) {
      return new NextResponse(JSON.stringify({ message: 'Request body must be an array of leaderboard entries.' }), { status: 400 });
    }

    const leaderboardCollection = db.collection('leaderboard');

    // 4. Clear the existing leaderboard
    console.log('Clearing existing leaderboard...');
    await deleteCollection(db, 'leaderboard');
    console.log('Leaderboard cleared.');


    if (rawData.length === 0) {
        console.log('No new entries provided. Leaderboard is now empty.');
        return new NextResponse(JSON.stringify({ message: 'Leaderboard cleared. No new entries provided.' }), { status: 200 });
    }

    // 5. Prepare and write the new batch
    console.log(`Preparing to write ${rawData.length} new entries.`);
    const batch = db.batch();
    let entriesWritten = 0;
    for (const entry of rawData) {
        // Use the header names from the Google Sheet.
        // Make.com sends them as properties on the object.
        const cybaName = entry.cybaName;
        if (!cybaName || typeof cybaName !== 'string' || cybaName.trim() === '') {
            console.warn('Skipping entry with invalid or empty cybaName:', entry);
            continue;
        }

        // Sanitize name for a safe document ID
        const docId = cybaName.trim().replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        if (!docId) continue;
        
        const docRef = leaderboardCollection.doc(docId);
        
        const dataToSave = {
            cybaName: entry.cybaName,
            cybaIg: entry.cybaIg || '',
            tier: entry.tier || '',
            outwardEngagement: Number(entry.outwardEngagement || 0),
            inwardEngagement: Number(entry.inwardEngagement || 0),
            features: Number(entry.features || 0),
            cybaCoin: Number(entry.cybaCoin || 0),
        };

        batch.set(docRef, dataToSave);
        entriesWritten++;
    }
    
    // 6. Commit the new batch
    await batch.commit();
    console.log(`Leaderboard updated successfully with ${entriesWritten} entries.`);

    return new NextResponse(JSON.stringify({ message: `Leaderboard updated successfully with ${entriesWritten} entries.` }), { status: 200 });

  } catch (error) {
    console.error('Error processing leaderboard update:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: errorMessage }), { status: 500 });
  }
}
