
import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, getApps, App, getApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { v4 as uuidv4 } from 'uuid';

// --- Firebase Admin Initialization ---
// This safely initializes the admin SDK or gets the existing instance.
function initializeFirebaseAdmin(): App {
  if (getApps().length > 0) {
    return getApp();
  }
  
  const credentialsStr = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  
  try {
    const serviceAccount = credentialsStr ? JSON.parse(credentialsStr) : undefined;
    
    // Initialize with explicit credentials if available (for local dev), 
    // otherwise default to Application Default Credentials (for deployed environments).
    // The storageBucket is specified to ensure the correct bucket is used.
    return initializeApp({
      credential: serviceAccount ? cert(serviceAccount) : undefined,
      storageBucket: "studio-9029052952-9df3f.appspot.com",
    });
  } catch (e) {
    console.error('Upload API Error: Failed to parse or use service account credentials.', e);
    throw new Error('Server authentication configuration error.');
  }
}

export async function POST(request: NextRequest) {
    try {
        const adminApp = initializeFirebaseAdmin();
        // The bucket is specified in initializeApp, so just call bucket()
        const bucket = getStorage(adminApp).bucket();

        const body = await request.json();
        const { fileDataUri, fileName, fileType } = body;

        if (!fileDataUri || !fileName || !fileType) {
            return NextResponse.json({ error: 'Missing required file data: fileDataUri, fileName, or fileType.' }, { status: 400 });
        }

        const base64EncodedString = fileDataUri.split(',')[1];
        if (!base64EncodedString) {
            return NextResponse.json({ error: 'Invalid data URI format.' }, { status: 400 });
        }
        
        const buffer = Buffer.from(base64EncodedString, 'base64');
        const uniqueFileName = `${uuidv4()}-${fileName.replace(/\s+/g, '_')}`;
        const filePath = `cybazone_uploads/${uniqueFileName}`;
        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: { contentType: fileType },
            public: true // Make the file public upon upload
        });

        // The public URL can be constructed directly
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;

        return NextResponse.json({ imageUrl: publicUrl }, { status: 200 });

    } catch (error) {
        console.error('--- Upload API Error ---', error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during file upload.';
        return NextResponse.json({ error: 'Upload failed.', details: errorMessage }, { status: 500 });
    }
}
