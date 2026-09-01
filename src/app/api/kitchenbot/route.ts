import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from '../firebase-admin';

const GEMINI_URL  = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const CLAUDE_URL  = 'https://api.anthropic.com/v1/messages';

// ── Helpers ────────────────────────────────────────────────────────────────

// wavBase64 is the full WAV file (header + PCM) as base64, sent by the ESP32
async function transcribeAudio(wavBase64: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: 'audio/wav', data: wavBase64 } },
          { text: 'Transcribe this audio exactly as spoken. Return only the transcription text, nothing else.' },
        ],
      }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini transcription error: ${err}`);
  }

  const json = await res.json();
  return (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
}

async function parseOrder(transcript: string): Promise<ParsedOrder> {
  const prompt = `You are a kitchen order parser for a busy restaurant. Parse the spoken order below into a structured kitchen ticket.

Spoken order: "${transcript}"

Return ONLY valid JSON (no markdown, no explanation) with this exact shape:
{
  "items": [
    {
      "name": "Menu item name",
      "quantity": 1,
      "modifications": ["modification 1", "modification 2"],
      "station": "grill|fryer|cold|prep|expo|bar",
      "steps": [
        "Step 1 — specific cooking instruction",
        "Step 2 — specific cooking instruction"
      ],
      "estimatedMinutes": 8
    }
  ],
  "notes": "any special table notes or urgency",
  "totalEstimatedMinutes": 10
}

Rules:
- "station" must be one of: grill, fryer, cold, prep, expo, bar
- Include 3–6 specific preparation steps per item (temperature, timing, technique, plating)
- estimatedMinutes is realistic cook time for a professional kitchen
- If quantity is not specified, default to 1
- modifications is an empty array if none specified`;

  const res = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error: ${err}`);
  }

  const json  = await res.json();
  const text  = json.content?.[0]?.text ?? '{}';
  const clean = text.replace(/```json|```/g, '').trim();
  return JSON.parse(clean) as ParsedOrder;
}

async function nextTicketNumber(): Promise<number> {
  const counterRef = adminDb.doc('settings/kitchenbot');
  const result = await adminDb.runTransaction(async (tx) => {
    const snap  = await tx.get(counterRef);
    const current = snap.exists ? (snap.data()?.ticketCounter ?? 0) : 0;
    const next    = (current % 999) + 1; // wrap 1–999
    tx.set(counterRef, { ticketCounter: next }, { merge: true });
    return next;
  });
  return result;
}

// ── Types ──────────────────────────────────────────────────────────────────

type ParsedOrder = {
  items: {
    name: string;
    quantity: number;
    modifications: string[];
    station: string;
    steps: string[];
    estimatedMinutes: number;
  }[];
  notes?: string;
  totalEstimatedMinutes: number;
};

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { audio, sampleRate = 16000, deviceId = 'esp32' } = body as {
      audio: string;
      sampleRate?: number;
      deviceId?: string;
    };

    if (!audio) {
      return NextResponse.json({ error: 'Missing audio field (base64 WAV)' }, { status: 400 });
    }

    // 1. Transcribe via Gemini
    const transcript = await transcribeAudio(audio);
    if (!transcript) {
      return NextResponse.json({ error: 'Could not transcribe audio' }, { status: 422 });
    }

    // 2. Parse into structured ticket
    const parsed = await parseOrder(transcript);

    // 3. Assign ticket number
    const ticketNumber = await nextTicketNumber();

    // 4. Save to Firestore
    const ticketRef = adminDb.collection('kitchen_tickets').doc();
    const now       = FieldValue.serverTimestamp();
    await ticketRef.set({
      ticketNumber,
      transcript,
      items:                   parsed.items,
      notes:                   parsed.notes ?? '',
      totalEstimatedMinutes:   parsed.totalEstimatedMinutes,
      status:                  'new',
      deviceId,
      createdAt:               now,
      updatedAt:               now,
    });

    return NextResponse.json({
      ticketId:     ticketRef.id,
      ticketNumber,
      transcript,
      items:        parsed.items,
      notes:        parsed.notes,
      estimatedMin: parsed.totalEstimatedMinutes,
    });

  } catch (err: any) {
    console.error('[KitchenBot]', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}

// Status update — PATCH /api/kitchenbot { ticketId, status }
export async function PATCH(request: NextRequest) {
  try {
    const { ticketId, status } = await request.json() as { ticketId: string; status: string };
    if (!ticketId || !['new', 'in-progress', 'done'].includes(status)) {
      return NextResponse.json({ error: 'Invalid ticketId or status' }, { status: 400 });
    }
    await adminDb.doc(`kitchen_tickets/${ticketId}`).update({
      status,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
