
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, CollectionReference } from 'firebase-admin/firestore';

// --- Firebase Admin Initialization ---
let adminApp: App;
let db: Firestore;

if (!getApps().length) {
  try {
    adminApp = initializeApp();
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error);
    // Fallback for local dev if needed, but primarily rely on ADC
    if (process.env.SERVICE_ACCOUNT_KEY) {
        adminApp = initializeApp({
            credential: cert(JSON.parse(process.env.SERVICE_ACCOUNT_KEY))
        });
    } else {
         // In a deployed environment, this should ideally not be reached.
         // If it is, the service account permissions/setup are likely incorrect.
         // Let the request fail later with a clear DB connection error.
    }
  }
} else {
  adminApp = getApps()[0];
}
db = getFirestore(adminApp);


// --- Helper function to delete all documents in a collection ---
async function deleteCollection(collectionRef: CollectionReference, batchSize: number = 100) {
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: (value?: unknown) => void) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
        // When there are no documents left, we are done
        return resolve();
    }

    // Delete documents in a batch
    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    // Recurse on the next process tick, to avoid hitting stack limits
    process.nextTick(() => {
        deleteQueryBatch(query, resolve);
    });
}


// --- API Endpoint ---
export async function POST(request: Request) {
  // 1. Secure the endpoint
  const authToken = request.headers.get('Authorization');
  const expectedToken = `Bearer ${process.env.LEADERBOARD_API_SECRET}`;

  if (!authToken || authToken !== expectedToken) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  try {
    // 2. Process incoming data
    const rawData = await request.json();
    if (!Array.isArray(rawData)) {
      return new NextResponse(JSON.stringify({ message: 'Request body must be an array.' }), { status: 400 });
    }

    const leaderboardCollection = db.collection('leaderboard');

    // 3. Clear the existing leaderboard
    await deleteCollection(leaderboardCollection);

    // 4. Prepare the new batch
    if (rawData.length === 0) {
        return new NextResponse(JSON.stringify({ message: 'Leaderboard cleared. No new entries provided.' }), { status: 200 });
    }

    const batch = db.batch();
    for (const entry of rawData) {
        // Use header names from Google Sheet. Make sure "Table contains headers" is YES.
        const cybaName = entry.cybaName;
        if (!cybaName || typeof cybaName !== 'string') {
            console.warn('Skipping entry with invalid cybaName:', entry);
            continue;
        }

        // Sanitize name for a safe document ID
        const docId = cybaName.trim().replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        if (!docId) continue;
        
        const docRef = leaderboardCollection.doc(docId);
        
        const dataToSave = {
            cybaName: cybaName,
            cybaIg: entry.cybaIg || '',
            tier: entry.tier || '',
            outwardEngagement: Number(entry.outwardEngagement || 0),
            inwardEngagement: Number(entry.inwardEngagement || 0),
            features: Number(entry.features || 0),
            cybaCoin: Number(entry.cybaCoin || 0),
        };

        batch.set(docRef, dataToSave);
    }
    
    // 5. Commit the new batch
    await batch.commit();

    return new NextResponse(JSON.stringify({ message: `Leaderboard updated successfully with ${rawData.length} entries.` }), { status: 200 });

  } catch (error) {
    console.error('Error processing leaderboard update:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: errorMessage }), { status: 500 });
  }
}
