
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

// --- Firebase Admin Initialization ---
let adminApp: App | null = null;

function getFirebaseAdmin(): App {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }
  
  try {
    const serviceAccount = JSON.parse(process.env.firebase_service_account_key!);
    adminApp = initializeApp({ credential: cert(serviceAccount) });
    return adminApp;
  } catch (e: any) {
    console.error("Fatal: Could not initialize Firebase Admin SDK. Make sure firebase_service_account_key is set correctly in your environment.", e.message);
    throw new Error("Server configuration error: Firebase Admin SDK failed to initialize.");
  }
}

// --- Helper to delete all documents in a collection ---
async function deleteCollection(db: Firestore, collectionPath: string) {
    const collectionRef = db.collection(collectionPath);
    const snapshot = await collectionRef.limit(500).get(); 
    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });
    await batch.commit();

    if (snapshot.size === 500) {
        await deleteCollection(db, collectionPath);
    }
}

// --- API Endpoint ---
export async function POST(request: Request) {
  // 1. Secure the endpoint
  const secret = process.env.leaderboard_api_secret;
  
  if (!secret || secret.trim() === '') {
    console.error("LEADERBOARD_API_SECRET is not loaded. Check permissions and backend configuration.");
    return new NextResponse(JSON.stringify({ message: 'Server secret not configured. The API key for this route is missing from the server environment.' }), { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized: Missing or invalid Authorization header.' }), { status: 401 });
  }

  const providedToken = authHeader.substring(7); // Remove "Bearer "
  
  if (providedToken.trim() !== secret.trim()) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized: Invalid token.' }), { status: 401 });
  }

  // 2. Check that the request body is valid
  let incomingData;
  try {
    incomingData = await request.json();
  } catch (e) {
    return new NextResponse(JSON.stringify({ message: 'Invalid JSON in request body.' }), { status: 400 });
  }

  if (!incomingData) {
    return new NextResponse(JSON.stringify({ message: 'Request body is empty.' }), { status: 400 });
  }

  // Make the logic flexible: handle both a single object and an array of objects
  const entriesToProcess = Array.isArray(incomingData) ? incomingData : [incomingData];

  if (entriesToProcess.length === 0) {
      return new NextResponse(JSON.stringify({ message: 'No entries to process.' }), { status: 200 });
  }

  // 3. Initialize Firebase Admin
  const db = getFirestore(getFirebaseAdmin());
  
  // 4. Process and Prepare Data
  const headers = Object.keys(entriesToProcess[0]);
  
  const entries = entriesToProcess.map(rowObject => {
      const entry: { [key: string]: any } = {};
      headers.forEach(header => {
          const value = rowObject[header];
          // Use the correct field names from your Google Sheet
          if (['outwardEngagement', 'inwardEngagement', 'features', 'cybaCoin'].includes(header)) {
              entry[header] = Number(value) || 0;
          } else {
              entry[header] = value || '';
          }
      });
      return entry;
  }).filter(entry => entry.cybaName); // Filter out entries without a cybaName


  // 5. Clear the existing leaderboard & write new data
  try {
    const leaderboardCollection = db.collection('leaderboard');
    await deleteCollection(db, 'leaderboard');
    
    const batch = db.batch();
    let entriesWritten = 0;

    for (const entry of entries) {
        // Create a Firestore-safe ID from the name
        const docId = String(entry.cybaName).trim().replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        if (!docId) continue;
        const docRef = leaderboardCollection.doc(docId);
        batch.set(docRef, entry);
        entriesWritten++;
    }

    await batch.commit();

    return new NextResponse(JSON.stringify({ message: `Leaderboard synced successfully. ${entriesWritten} entries written.` }), { status: 200 });

  } catch (error) {
    console.error('Error during Firestore operation:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error during database update.', error: errorMessage }), { status: 500 });
  }
}
