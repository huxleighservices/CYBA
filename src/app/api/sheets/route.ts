
import { google } from 'googleapis';
import { NextResponse } from 'next/server';

const sheets = google.sheets('v4');

export async function GET(req: Request) {
  try {
    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable not set.');
    }
    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID environment variable not set.');
    }

    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1!A:G', // Assuming Sheet1 and columns A-G
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      return NextResponse.json([]); // Return empty if no data or only headers
    }

    const headers: string[] = rows[0].map(h => h.trim());
    const data = rows.slice(1).map((row) =>
      headers.reduce((obj: Record<string, any>, header: string, index: number) => {
        const numericHeaders = ['outwardEngagement', 'inwardEngagement', 'features', 'cybaCoin'];
        let value = row[index] || '';
        if (numericHeaders.includes(header)) {
          value = Number(value) || 0;
        }
        obj[header] = value;
        return obj;
      }, {})
    ).sort((a, b) => b.cybaCoin - a.cybaCoin); // Sort by cybaCoin descending

    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch sheet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to fetch sheet data', details: errorMessage }, { status: 500 });
  }
}
