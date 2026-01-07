// app/api/sheets/route.ts
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;
    
    if (!sheetId || !credentialsStr) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      );
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
      range: 'Sheet1!A:I',
      valueRenderOption: 'UNFORMATTED_VALUE',
    });

    const rows = response.data.values || [];

    if (rows.length < 2) {
      return NextResponse.json([]);
    }

    // Sheet structure:
    // A=0: CYBANAME, B=1: CYBA IG, C=2: TIER, D=3: OUTWARD, E=4: INWARD, 
    // F=5: FEATURES, G=6: EXTRAS, H=7: CYBACOIN, I=8: Last Updated
    const data = rows.slice(1).map((row: any[]) => {
      const cybaName = String(row[0] || '').trim();
      if (!cybaName) return null;

      return {
        cybaName,
        cybaIg: String(row[1] || '').trim(),
        tier: String(row[2] || '').trim(),
        outwardEngagement: Number(row[3]) || 0,
        inwardEngagement: Number(row[4]) || 0,
        features: Number(row[5]) || 0,
        extras: Number(row[6]) || 0,
        cybaCoin: Number(row[7]) || 0,  // Column H (index 7)
        lastUpdated: String(row[8] || '').trim(),
      };
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sheet data', details: String(error) },
      { status: 500 }
    );
  }
}
