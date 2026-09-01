import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminDb } from '../firebase-admin';
import type { NotificationType } from '@/lib/notifications';

// ── Nodemailer transporter ──────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ── Subject line per notification type ─────────────────────────────────────
function buildSubject(type: NotificationType, actorUsername: string): string {
  switch (type) {
    case 'like':               return `${actorUsername} liked your post`;
    case 'comment':            return `${actorUsername} commented on your post`;
    case 'repost':             return `${actorUsername} reposted your post`;
    case 'follow':             return `${actorUsername} started following you`;
    case 'mention':            return `${actorUsername} mentioned you`;
    case 'submission_approved': return 'Your submission was approved! ✅';
    case 'submission_rejected': return 'Update on your submission';
    default:                   return 'New notification from CYBAZONE';
  }
}

// ── HTML email body ─────────────────────────────────────────────────────────
function buildHtml(message: string, href: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0a0a0f;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111118;border:1px solid #2a1f4a;border-radius:16px;overflow:hidden;max-width:520px;">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#3b0764,#1a0533);padding:24px 32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:2px;">⚡ CYBAZONE</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 20px;font-size:16px;color:#e2e8f0;line-height:1.6;">${message}</p>
            <a href="${href}"
               style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
              View in CYBAZONE →
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1e1b2e;">
            <p style="margin:0;font-size:11px;color:#6b7280;text-align:center;">
              You're receiving this because you enabled email notifications in CYBAZONE.<br/>
              <a href="${process.env.NEXT_PUBLIC_APP_URL ?? 'https://cybazone.com'}/profile"
                 style="color:#7c3aed;">Turn off email notifications</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Route handler ────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Only proceed if email is configured
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return NextResponse.json({ ok: false, reason: 'email not configured' });
  }

  try {
    const body = await request.json();
    const {
      recipientId,
      type,
      message,
      actorUsername = 'Someone',
      linkTo,
    } = body as {
      recipientId: string;
      type: NotificationType;
      message?: string;
      actorUsername?: string;
      linkTo?: string;
    };

    if (!recipientId || !type) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Look up recipient
    const userSnap = await adminDb.doc(`users/${recipientId}`).get();
    if (!userSnap.exists) return NextResponse.json({ ok: false });

    const userData = userSnap.data();
    if (!userData?.emailNotifications || !userData?.email) {
      return NextResponse.json({ ok: false, reason: 'disabled or no email' });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cybazone.com';
    const href = linkTo ? `${appUrl}${linkTo.startsWith('/') ? linkTo : `/${linkTo}`}` : appUrl;

    // Build readable message
    const displayMessage = message ?? buildSubject(type, actorUsername);

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"CYBAZONE" <${process.env.GMAIL_USER}>`,
      to: userData.email,
      subject: buildSubject(type, actorUsername),
      html: buildHtml(displayMessage, href),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    // Non-critical — log but don't throw
    console.error('[send-notification-email]', e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
