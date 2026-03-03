
// src/app/api/sync-leaderboard/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { initializeApp, getApps, App, getApp } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

// --- Types ---
interface LeaderboardEntry {
  cybaName?: string;
  cybaCoin?: number;
  [key: string]: any;
}

interface UserDoc {
  leaderboardCybaName?: string;
  cybaCoinBalance?: number;
  [key: string]: any;
}

// --- Firebase Admin Initialization ---
// Initialize Firebase Admin SDK if not already done
function initializeFirebaseAdmin(): App {
  // When running in a Google Cloud environment (like Firebase App Hosting),
  // the Admin SDK automatically detects service account credentials.
  if (getApps().length) {
    return getApp();
  }
  // Let the SDK use Application Default Credentials.
  return initializeApp();
}

// --- Google Sheets API Helper ---
async function getSheetData(): Promise<LeaderboardEntry[]> {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;

  if (!sheetId || !credentialsStr) {
    throw new Error('Google Sheets environment variables not configured');
  }
  const credentials = JSON.parse(credentialsStr);
  
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets('v4');
  const response = await sheets.spreadsheets.values.get({
    auth,
    spreadsheetId: sheetId,
    range: 'Sheet1',
  });

  const rows = response.data.values || [];
  if (rows.length < 2) return [];

  // FIXED: Use explicit column indices based on actual sheet structure
  // A=0: CYBANAME, B=1: CYBA IG, C=2: TIER, D=3: OUTWARD, E=4: INWARD, 
  // F=5: FEATURES, G=6: EXTRAS, H=7: CYBACOIN, I=8: Last Updated
  const NAME_INDEX = 0;  // Column A - CYBANAME
  const COIN_INDEX = 7;  // Column H - CYBACOIN

  return rows.slice(1).map(row => ({
    cybaName: String(row[NAME_INDEX] || '').trim(),
    cybaCoin: Number(row[COIN_INDEX]) || 0,
  })).filter(entry => entry.cybaName);
}


// --- Main API Route Handler ---
export async function POST(request: NextRequest) {
  try {
    // Initialize Firebase Admin
    const adminApp = initializeFirebaseAdmin();
    const db: Firestore = getFirestore(adminApp);
    
    // 1. Fetch data from Google Sheet
    const sheetData = await getSheetData();
    const sheetMap = new Map<string, number>(
      sheetData.map(entry => [entry.cybaName!.toLowerCase(), entry.cybaCoin!])
    );
    
    // 2. Fetch all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    if (usersSnapshot.empty) {
      return NextResponse.json({ message: 'No users to sync.', updatedCount: 0 });
    }

    // 3. Compare and update
    let updatedCount = 0;
    const batch = db.batch();

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data() as UserDoc;
      const linkedName = userData.leaderboardCybaName;

      if (linkedName) {
        const lowerCaseLinkedName = linkedName.toLowerCase();
        
        if (sheetMap.has(lowerCaseLinkedName)) {
          const sheetCoinBalance = sheetMap.get(lowerCaseLinkedName)!;
          const firestoreCoinBalance = userData.cybaCoinBalance || 0;
          
          // If balance is different, stage an update in the batch
          if (sheetCoinBalance !== firestoreCoinBalance) {
            batch.update(userDoc.ref, { cybaCoinBalance: sheetCoinBalance });
            updatedCount++;
          }
        }
      }
    }
    
    // 4. Commit all updates at once
    if (updatedCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ 
      message: 'Sync completed successfully.', 
      updatedCount 
    });

  } catch (error) {
    console.error('Error in /api/sync-leaderboard:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
