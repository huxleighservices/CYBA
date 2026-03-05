
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
    if (credentialsStr) {
      const serviceAccount = JSON.parse(credentialsStr);
      // Initialize with explicit service account for local dev
      return initializeApp({
        credential: cert(serviceAccount),
        storageBucket: "studio-9029052952-9df3f.appspot.com",
      });
    } else {
      // Initialize with Application Default Credentials for deployed env,
      // but still provide the bucket.
      return initializeApp({
        storageBucket: "studio-9029052952-9df3f.appspot.com",
      });
    }
  } catch (e) {
    console.error('Upload API Error: Failed to parse or use service account credentials.', e);
    throw new Error('Server authentication configuration error.');
  }
}

export async function POST(request: NextRequest) {
    try {
        const adminApp = initializeFirebaseAdmin();
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
