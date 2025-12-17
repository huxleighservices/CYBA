
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore, CollectionReference } from 'firebase-admin/firestore';

// --- Firebase Admin Initialization ---
let adminApp: App;
let db: Firestore;

// This pattern prevents re-initializing the app on every hot-reload
if (!getApps().length) {
  // Try to initialize with default credentials (ideal for deployed environments)
  try {
    adminApp = initializeApp();
  } catch (error) {
    console.error("Default Firebase Admin initialization failed, trying service account key.", error);
    // Fallback for local development if SERVICE_ACCOUNT_KEY is set
    if (process.env.SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
        adminApp = initializeApp({
          credential: cert(serviceAccount)
        });
      } catch (e) {
        console.error("Firebase Admin initialization with service account key failed.", e);
      }
    } else {
        console.warn("SERVICE_ACCOUNT_KEY environment variable not set. Firebase Admin may not be initialized.");
    }
  }
} else {
  adminApp = getApps()[0];
}

// Only get firestore instance if the app was initialized
if (adminApp) {
    db = getFirestore(adminApp);
}

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
    console.warn('Unauthorized access attempt');
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  // Check if DB is initialized
  if (!db) {
    console.error('Firestore database is not initialized. Check Firebase Admin setup.');
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error: Database connection failed.'}), { status: 500 });
  }

  try {
    // 2. Process incoming data
    const rawData = await request.json();
    if (!Array.isArray(rawData)) {
      return new NextResponse(JSON.stringify({ message: 'Request body must be an array of leaderboard entries.' }), { status: 400 });
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
        if (!cybaName || typeof cybaName !== 'string' || cybaName.trim() === '') {
            console.warn('Skipping entry with invalid or empty cybaName:', entry);
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
