#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  CYBAZONE — Cloud Scheduler setup for weekly payout & leaderboard reset
#
#  Run once after deploying to Firebase App Hosting.
#  Requires: gcloud CLI authenticated, correct PROJECT_ID set.
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ID="studio-9029052952-9df3f"   # your Firebase project ID
APP_URL="https://cybazone.com"         # your deployed App Hosting URL (the App Hosting default
                                        # domains like *.web.app / *.hosted.app 404 on this
                                        # project — cybazone.com is the real serving domain)
CRON_SECRET="$(gcloud secrets versions access latest --secret=CRON_SECRET --project=$PROJECT_ID)"
REGION="us-central1"

echo "Setting up Cloud Scheduler jobs for project: $PROJECT_ID"
echo "App URL: $APP_URL"

# ── 1. Friday 11:59 PM EST = Saturday 04:59 UTC ──────────────────────────────
gcloud scheduler jobs create http cybazone-weekly-payout \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="59 04 * * 6" \
  --uri="$APP_URL/api/cron/weekly-payout" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Friday 11:59 PM EST — issue weekly leaderboard payouts"

echo "✓ weekly-payout job created (runs Sat 04:59 UTC = Fri 11:59 PM EST)"

# ── 2. Saturday 12:01 AM EST = Saturday 05:01 UTC ────────────────────────────
gcloud scheduler jobs create http cybazone-weekly-reset \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="1 05 * * 6" \
  --uri="$APP_URL/api/cron/weekly-reset" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Saturday 12:01 AM EST — reset weekly leaderboard"

echo "✓ weekly-reset job created (runs Sat 05:01 UTC = Sat 12:01 AM EST)"

# ── 4. Every 5 minutes — publish scheduled posts ──────────────────────────────
gcloud scheduler jobs create http cybazone-publish-scheduled \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="*/5 * * * *" \
  --uri="$APP_URL/api/cron/publish-scheduled" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Every 5 minutes — publish scheduled posts when their time arrives"

echo "✓ publish-scheduled job created (runs every 5 minutes)"

# ── 5. Daily 9:00 AM EST = 14:00 UTC — birthday gifts ─────────────────────────
gcloud scheduler jobs create http cybazone-birthday-gift \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 14 * * *" \
  --uri="$APP_URL/api/cron/birthday-gift" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Daily 9:00 AM EST — grant birthday CYBACOIN gifts"

echo "✓ birthday-gift job created (runs daily at 14:00 UTC = 9:00 AM EST)"

# ── 6. Saturday 12:10 AM EST = Saturday 05:10 UTC — weekly boost billing ─────
# 10 minutes after weekly-reset so it never races the same week's data.
gcloud scheduler jobs create http cybazone-weekly-boost-billing \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="10 05 * * 6" \
  --uri="$APP_URL/api/cron/weekly-boost-billing" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Saturday 12:10 AM EST — bill weekly CC boost subscriptions"

echo "✓ weekly-boost-billing job created (runs Sat 05:10 UTC = Sat 12:10 AM EST)"

# ── 7. Daily 10:00 AM EST = 15:00 UTC — promo expiry warnings ────────────────
gcloud scheduler jobs create http cybazone-promo-expiry-warning \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 15 * * *" \
  --uri="$APP_URL/api/cron/promo-expiry-warning" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Daily 10:00 AM EST — warn promoters 3 days before expiry"

echo "✓ promo-expiry-warning job created (runs daily at 15:00 UTC = 10:00 AM EST)"

# ── 8. Every hour — expire/promote ads ────────────────────────────────────────
gcloud scheduler jobs create http cybazone-cleanup-ads \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 * * * *" \
  --uri="$APP_URL/api/cron/cleanup-ads" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Every hour — expire active Promo Blast ads past their expiresAt"

echo "✓ cleanup-ads job created (runs every hour)"

# ── 9. Every hour — delete expired Pulses ─────────────────────────────────────
gcloud scheduler jobs create http cybazone-cleanup-pulses \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="5 * * * *" \
  --uri="$APP_URL/api/cron/cleanup-pulses" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Every hour — delete expired Pulses"

echo "✓ cleanup-pulses job created (runs every hour)"

echo ""
echo "Done! View jobs at:"
echo "  https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID"
