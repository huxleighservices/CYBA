#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  CYBAZONE — Cloud Scheduler setup for weekly payout & leaderboard reset
#
#  Run once after deploying to Firebase App Hosting.
#  Requires: gcloud CLI authenticated, correct PROJECT_ID set.
# ─────────────────────────────────────────────────────────────────────────────

PROJECT_ID="studio-9029052952-9df3f"   # your Firebase project ID
APP_URL="https://cybaweb.web.app"      # your deployed App Hosting URL
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

# ── 3. Every hour — clean up expired sponsored items ─────────────────────────
gcloud scheduler jobs create http cybazone-cleanup-sponsored \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="0 * * * *" \
  --uri="$APP_URL/api/cron/cleanup-sponsored" \
  --http-method=POST \
  --headers="x-cron-secret=$CRON_SECRET,Content-Type=application/json" \
  --message-body="{}" \
  --time-zone="UTC" \
  --description="CYBAZONE: Every hour — delete expired sponsored posts/profiles"

echo "✓ cleanup-sponsored job created (runs every hour)"

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

echo ""
echo "Done! View jobs at:"
echo "  https://console.cloud.google.com/cloudscheduler?project=$PROJECT_ID"
