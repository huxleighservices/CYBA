
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// --- Firebase Admin Initialization ---
let adminApp: App;
let db: Firestore;

// This specific initialization pattern is crucial for serverless environments like App Hosting.
// It prevents re-initialization on every function invocation.
if (!getApps().length) {
  // When deployed, App Hosting provides GOOGLE_APPLICATION_CREDENTIALS.
  // In local development, you can set the FIREBASE_SERVICE_ACCOUNT_KEY env var.
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        adminApp = initializeApp({ credential: cert(serviceAccount) });
    } catch(e) {
        console.error("Error initializing Firebase Admin with service account key:", e);
    }
  } else {
    // This is the default for deployed environments.
    adminApp = initializeApp();
  }
} else {
  adminApp = getApps()[0];
}

// Ensure db is initialized only if adminApp was successful.
if (adminApp) {
    db = getFirestore(adminApp);
}

// --- Helper to delete all documents in a collection ---
async function deleteCollection(collectionPath: string, batchSize: number = 100) {
    const collectionRef = db.collection(collectionPath);
    const query = collectionRef.limit(batchSize);

    return new Promise((resolve, reject) => {
        deleteQueryBatch(query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(query: FirebaseFirestore.Query, resolve: (value?: unknown) => void) {
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
        deleteQueryBatch(query, resolve);
    });
}

// --- API Endpoint ---
export async function POST(request: Request) {
  // 1. Secure the endpoint
  const authToken = request.headers.get('Authorization');
  const expectedToken = `Bearer ${process.env.LEADERBOARD_API_SECRET}`;

  if (!authToken || authToken !== expectedToken) {
    console.warn('Unauthorized access attempt to /api/leaderboard');
    return new NextResponse(JSON.stringify({ message: 'Unauthorized' }), { status: 401 });
  }

  // 2. Check if DB is initialized
  if (!db) {
    console.error('Firestore database is not initialized. Check Firebase Admin setup.');
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error: Database connection failed.'}), { status: 500 });
  }

  try {
    // 3. Process incoming data
    const rawData = await request.json();
    if (!Array.isArray(rawData)) {
      return new NextResponse(JSON.stringify({ message: 'Request body must be an array of leaderboard entries.' }), { status: 400 });
    }

    const leaderboardCollection = db.collection('leaderboard');

    // 4. Clear the existing leaderboard
    console.log('Clearing existing leaderboard...');
    await deleteCollection('leaderboard');
    console.log('Leaderboard cleared.');


    if (rawData.length === 0) {
        return new NextResponse(JSON.stringify({ message: 'Leaderboard cleared. No new entries provided.' }), { status: 200 });
    }

    // 5. Prepare the new batch
    console.log(`Preparing to write ${rawData.length} new entries.`);
    const batch = db.batch();
    for (const entry of rawData) {
        // Use the header names from the Google Sheet.
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
    
    // 6. Commit the new batch
    await batch.commit();
    console.log(`Leaderboard updated successfully with ${rawData.length} entries.`);

    return new NextResponse(JSON.stringify({ message: `Leaderboard updated successfully with ${rawData.length} entries.` }), { status: 200 });

  } catch (error) {
    console.error('Error processing leaderboard update:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: errorMessage }), { status: 500 });
  }
}
