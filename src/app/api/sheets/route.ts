// app/api/sheets/route.ts
import { google } from 'googleapis';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== Sheets API Debug Start ===');
    
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const credentialsStr = process.env.GOOGLE_SHEETS_CREDENTIALS;
    
    console.log('GOOGLE_SHEET_ID exists:', !!sheetId);
    console.log('GOOGLE_SHEETS_CREDENTIALS exists:', !!credentialsStr);
    
    if (!sheetId) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEET_ID not configured' },
        { status: 500 }
      );
    }

    if (!credentialsStr) {
      return NextResponse.json(
        { error: 'GOOGLE_SHEETS_CREDENTIALS not configured' },
        { status: 500 }
      );
    }

    let credentials;
    try {
      console.log('Parsing credentials...');
      credentials = JSON.parse(credentialsStr);
      console.log('✓ Credentials parsed successfully');
    } catch (parseError) {
      console.error('Failed to parse credentials:', parseError);
      return NextResponse.json(
        { error: 'Invalid credentials JSON', details: String(parseError) },
        { status: 500 }
      );
    }

    if (!credentials.private_key || !credentials.client_email) {
      console.error('Credentials missing required fields');
      return NextResponse.json(
        { error: 'Credentials missing required fields' },
        { status: 500 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets('v4');
    console.log('Fetching sheet:', sheetId);

    const response = await sheets.spreadsheets.values.get({
      auth,
      spreadsheetId: sheetId,
      range: 'Sheet1',
    });

    console.log('✓ Sheet data fetched');
    
    const rows = response.data.values || [];
    console.log('Total rows (including header):', rows.length);

    if (rows.length === 0) {
      console.warn('Sheet is empty');
      return NextResponse.json([]);
    }

    const headers = rows[0];
    console.log('Raw headers:', headers);

    if (!headers || headers.length === 0) {
      console.error('No headers found');
      return NextResponse.json({ error: 'Sheet has no headers' }, { status: 500 });
    }

    // Map column indices to expected field names
    // Adjust these based on your actual column positions
    const headerMap: { [key: number]: string } = {};
    
    headers.forEach((header: string, index: number) => {
      const lowerHeader = String(header).toLowerCase().trim();
      
      if (lowerHeader.includes('cybaname') || lowerHeader.includes('name')) {
        headerMap[index] = 'cybaName';
      } else if (lowerHeader.includes('cybaig') || lowerHeader.includes('instagram')) {
        headerMap[index] = 'cybaIg';
      } else if (lowerHeader.includes('tier')) {
        headerMap[index] = 'tier';
      } else if (lowerHeader.includes('outward')) {
        headerMap[index] = 'outwardEngagement';
      } else if (lowerHeader.includes('inward')) {
        headerMap[index] = 'inwardEngagement';
      } else if (lowerHeader.includes('feature')) {
        headerMap[index] = 'features';
      } else if (lowerHeader.includes('cybacoin') || lowerHeader.includes('points') || lowerHeader.includes('coin')) {
        headerMap[index] = 'cybaCoin';
      }
    });

    console.log('Header map:', headerMap);

    // Convert rows to objects, filtering out empty rows
    const data = rows
      .slice(1)
      .map((row: string[], rowIndex: number) => {
        const obj: { [key: string]: any } = {};
        let hasData = false;

        Object.keys(headerMap).forEach((indexStr) => {
          const index = parseInt(indexStr);
          const fieldName = headerMap[index];
          const value = row[index] || '';

          // Only add field if header mapping exists
          if (fieldName) {
            // Try to convert to number if it's a numeric field
            if (['outwardEngagement', 'inwardEngagement', 'features', 'cybaCoin'].includes(fieldName)) {
              const numValue = isNaN(Number(value)) ? 0 : Number(value);
              obj[fieldName] = numValue;
              if (numValue !== 0) hasData = true;
            } else {
              obj[fieldName] = String(value).trim();
              if (value) hasData = true;
            }
          }
        });

        return hasData ? obj : null;
      })
      .filter((row) => row !== null);

    console.log('Processed rows:', data.length);
    console.log('First row:', data[0]);
    console.log('✓ Data conversion complete');

    return NextResponse.json(data);
  } catch (error) {
    console.error('API Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch sheet data', details: errorMessage },
      { status: 500 }
    );
  }
}