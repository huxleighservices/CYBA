import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error('GOOGLE_SHEET_ID environment variable is not set');
    }

    if (!process.env.GOOGLE_SHEETS_CREDENTIALS) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS environment variable is not set');
    }

    let credentials;
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
    } catch (parseError) {
      console.error('Failed to parse GOOGLE_SHEETS_CREDENTIALS:', parseError);
      throw new Error(
        'GOOGLE_SHEETS_CREDENTIALS is not valid JSON. Ensure the entire service account JSON file is set as the secret value.'
      );
    }

    if (!credentials.private_key || !credentials.client_email) {
      throw new Error('GOOGLE_SHEETS_CREDENTIALS is missing required fields (private_key, client_email)');
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Sheet1', // Assumes data is on 'Sheet1'
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
      return NextResponse.json([], { status: 200 });
    }

    const headers = rows[0] as string[];
    if (!headers || headers.length === 0) {
      throw new Error('Sheet has no headers in the first row');
    }

    const data = rows.slice(1).map((row: any[]) =>
      headers.reduce((obj: Record<string, any>, header: string, index: number) => {
        const value = row[index] || '';
        // Try to convert to number if it looks like a number and isn't empty
        obj[header] = !isNaN(Number(value)) && value.trim() !== '' ? Number(value) : value;
        return obj;
      }, {})
    );

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      {
        error: 'Failed to fetch sheet data',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
