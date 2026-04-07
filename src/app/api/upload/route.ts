import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { adminStorage } from '../firebase-admin';

export async function POST(request: NextRequest) {
    try {
        const bucket = adminStorage.bucket(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET);

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
        const token = uuidv4();
        const uniqueFileName = `${uuidv4()}-${fileName.replace(/\s+/g, '_')}`;
        const filePath = `cybazone_uploads/${uniqueFileName}`;
        const file = bucket.file(filePath);

        await file.save(buffer, {
            metadata: {
                contentType: fileType,
                metadata: { firebaseStorageDownloadTokens: token },
            },
        });

        const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const encodedPath = encodeURIComponent(filePath);
        const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`;

        return NextResponse.json({ imageUrl: downloadUrl }, { status: 200 });

    } catch (error: any) {
        console.error('--- Upload API Error ---', error);
        return NextResponse.json({ 
            error: 'Upload failed.',
            details: error?.message || 'Unknown error',
            code: error?.code || 'none',
        }, { status: 500 });
    } 
}
