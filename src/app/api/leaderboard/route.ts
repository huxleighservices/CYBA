
import { NextResponse } from 'next/server';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

// --- Firebase Admin Initialization ---
let adminApp: App | null = null;
let firestore: Firestore | null = null;

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
export async function GET(request: Request) {

  // --- Initialize Firebase Admin ---
  if (getApps().length === 0) {
    try {
      const serviceAccount = JSON.parse(process.env.firebase_service_account_key!);
      adminApp = initializeApp({ credential: cert(serviceAccount) });
      firestore = getFirestore(adminApp);
    } catch (e) {
        console.error("Fatal: Could not initialize Firebase Admin SDK from environment variable.", e);
        // Fallback or failure is handled below
    }
  } else {
    adminApp = getApps()[0];
    firestore = getFirestore(adminApp!);
  }

  if (!adminApp || !firestore) {
    return new NextResponse(JSON.stringify({ message: 'Server configuration error: Firebase Admin failed to initialize.' }), { status: 500 });
  }

  // 1. Initialize Google Sheets API
  const serviceAccountJson = process.env.google_sheets_service_account;
  const sheetId = '1LvD9pa_-dDRSmoVMfi7UWZRtefGPlsnmESgVdxCXQn4';
  const sheetRange = 'Sheet1!A:G';

  if (!serviceAccountJson) {
     return new NextResponse(JSON.stringify({ message: 'Google Sheets service account secret is not configured.' }), { status: 500 });
  }

  const serviceAccount = JSON.parse(serviceAccountJson);

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: serviceAccount.client_email,
      private_key: serviceAccount.private_key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    // 2. Fetch Data from Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: sheetRange,
    });
    const rows = response.data.values;

    if (!rows || rows.length < 2) { // < 2 to account for header row
      return new NextResponse(JSON.stringify({ message: 'No data found in sheet or only a header row exists.' }), { status: 200 });
    }

    // 3. Process and Prepare Data
    const headers = rows[0].map((header: string) => header.trim());
    const entries = rows.slice(1).map(row => {
      const entry: { [key: string]: any } = {};
      headers.forEach((header, index) => {
        const value = row[index];
        const numericHeaders = ['outwardEngagement', 'inwardEngagement', 'features', 'cybaCoin'];
        if (numericHeaders.includes(header)) {
            entry[header] = Number(value) || 0;
        } else {
            entry[header] = value || '';
        }
      });
      return entry;
    }).filter(entry => entry.cybaName); // Filter out entries without a cybaName


    // 4. Clear the existing leaderboard & write new data
    const leaderboardCollection = firestore.collection('leaderboard');
    await deleteCollection(firestore, 'leaderboard');
    
    const batch = firestore.batch();
    let entriesWritten = 0;

    for (const entry of entries) {
        const docId = String(entry.cybaName).trim().replace(/[^a-zA-Z0-9-]/g, '_').toLowerCase();
        if (!docId) continue;
        const docRef = leaderboardCollection.doc(docId);
        batch.set(docRef, entry);
        entriesWritten++;
    }

    await batch.commit();

    return new NextResponse(JSON.stringify({ message: `Leaderboard synced successfully. ${entriesWritten} entries written.` }), { status: 200 });

  } catch (error) {
    console.error('Error during Google Sheet sync:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error during Google Sheet sync.', error: errorMessage }), { status: 500 });
  }
}
