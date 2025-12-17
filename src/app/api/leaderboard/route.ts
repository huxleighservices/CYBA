
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
export async function GET(request: Request) {
  // 1. Secure the endpoint
  const secret = process.env.leaderboard_api_secret?.trim();
  const authHeader = request.headers.get('Authorization');
  
  if (!secret) {
    return new NextResponse(JSON.stringify({ message: 'Server secret not configured.' }), { status: 500 });
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized: Missing or invalid Authorization header.' }), { status: 401 });
  }

  const providedToken = authHeader.substring(7).trim(); // Remove "Bearer "
  
  if (providedToken !== secret) {
    return new NextResponse(JSON.stringify({ message: 'Unauthorized: Invalid token.' }), { status: 401 });
  }

  // 2. Check for required Google Sheets environment variables
  const { google_sheets_service_account, google_sheet_id, google_sheet_range } = process.env;
  if (!google_sheets_service_account || !google_sheet_id || !google_sheet_range) {
    console.error('Missing Google Sheets environment variables.');
    return new NextResponse(JSON.stringify({ message: 'Server is not configured for Google Sheets access.' }), { status: 500 });
  }

  try {
    // 3. Authenticate with Google Sheets
    const serviceAccount = JSON.parse(google_sheets_service_account);
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 4. Fetch data from Google Sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: google_sheet_id,
      range: google_sheet_range,
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) { 
      return new NextResponse(JSON.stringify({ message: 'No data found in spreadsheet or only headers present.' }), { status: 200 });
    }
    
    // 5. Initialize Firebase Admin
    const db = getFirestore(getFirebaseAdmin());
    
    // 6. Process and Prepare Data
    const headers = rows[0].map(h => h.trim());
    const dataRows = rows.slice(1);
    
    const entries = dataRows.map(row => {
        const entry: { [key: string]: any } = {};
        headers.forEach((header, index) => {
            const value = row[index];
            if (['outwardEngagement', 'inwardEngagement', 'features', 'cybaCoin'].includes(header)) {
                entry[header] = Number(value) || 0;
            } else {
                entry[header] = value || '';
            }
        });
        return entry;
    }).filter(entry => entry.cybaName);

    // 7. Clear the existing leaderboard & write new data
    const leaderboardCollection = db.collection('leaderboard');
    await deleteCollection(db, 'leaderboard');
    
    const batch = db.batch();
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
    console.error('Error syncing leaderboard from Google Sheet:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return new NextResponse(JSON.stringify({ message: 'Internal Server Error', error: errorMessage }), { status: 500 });
  }
}
