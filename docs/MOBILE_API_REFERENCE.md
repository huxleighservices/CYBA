# CYBAZONE — Mobile Integration Reference

This is a handoff doc for building a mobile client against the existing CYBAZONE backend. It covers how the system is put together, the Firestore data model, and which API endpoints are actually meant to be called by a client versus internal-only.

Last written: 2026-08-16, against the state of this repo at that commit. The schema below is reverse-engineered from the actual TypeScript types and Firestore calls in the codebase, not from a separate spec — if something here looks off versus the code, trust the code and treat this doc as slightly stale.

---

## 1. How this app is built

Next.js 15 (App Router) + Firebase (Firestore, Storage, Auth, Admin SDK), deployed on Firebase App Hosting at cybazone.com.

**The important part for a mobile app:** almost everything the web app does — reading the feed, posting, liking, following, sending messages, spending CYBACOIN — happens by talking **directly to Firestore/Storage from the client**, using the Firebase Web SDK, governed entirely by `firestore.rules` / `storage.rules`. There is no general-purpose "app API" layer in front of Firestore.

A mobile app should do the same thing: use the native Firebase SDK (iOS, Android, Flutter, or React Native) pointed at the **same Firebase project**, and read/write Firestore directly, following the same security rules. A small number of custom Next.js routes exist under `/api/*` for the handful of things a client can't safely do itself (server-only privileged writes, third-party webhooks, scheduled jobs) — those are cataloged in sections 6–7, and most of them are **not** meant to be called by a client at all.

---

## 2. Firebase project connection info

This is the public Web SDK config (`src/firebase/config.ts`) — it's already embedded in every page of the live site, so it isn't a secret. Firebase access control comes from security rules, not from hiding this key.

```
projectId:         studio-9029052952-9df3f
appId:              1:627500824058:web:5cca81d73b6f6176b6a043
apiKey:             AIzaSyBTsSZ4cH7B4Wp5-Rv1XTYbzn0yqwxHg3E
authDomain:         studio-9029052952-9df3f.firebaseapp.com
storageBucket:      studio-9029052952-9df3f.firebasestorage.app
messagingSenderId:  627500824058
```

For native iOS/Android, the mobile dev will register their app in the Firebase Console (which generates `GoogleService-Info.plist` / `google-services.json` — different from the web config above). They'll need to be added as a collaborator on the Firebase project itself for that (Firebase Console → Project Settings → Users and permissions, Viewer is enough to start).

**Do not** share the Admin SDK service account key, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or `CRON_SECRET` (all in `.env.local`, gitignored) — none of those are needed to build a client against this backend.

---

## 3. Auth

- Firebase Auth, two sign-up paths: email/password, and phone number OTP. On web, phone auth is reCAPTCHA-gated; native mobile SDKs handle phone auth without that.
- Usernames are auto-prefixed: the user picks a suffix and the app stores `username: "CYBA" + suffix"` (e.g. `CYBADALT`). Every user doc also stores `username_lowercase` for case-insensitive lookups — **all username queries in this app filter on `username_lowercase`, not `username`.**
- There is no server-side "create account" endpoint. On successful Firebase Auth signup, the client itself writes the initial `users/{uid}` doc directly (merge:true), then:
  - auto-follows two system accounts, looked up by `username_lowercase in ['cybazone', 'cybasuess']`
  - applies a referral bonus via `POST /api/referral` if a referrer username was entered (see section 6)
- Signup requires accepting two checkboxes (Terms & Agreements, Privacy Policy) before the submit button enables — no server-side enforcement of this, it's client-side only today.

---

## 4. Firestore data model

Root collections, each with purpose, key fields, and subcollections. Types are TypeScript shapes as used in the web app — Firestore itself is schemaless, so treat these as "what's actually written," not an enforced schema.

### `users/{uid}`
The core profile/account doc. Created by the client at signup, updated by both client and server (Admin SDK) depending on the field.

Identity: `id`, `username`, `username_lowercase`, `email`, `phone`, `fullName`, `bio`, `location`, `emojiStatus`, `profilePictureUrl`, `avatarConfig` (layered avatar-builder object, see `src/lib/avatar-assets.ts`), `leaderboardCybaName`

Social graph: `followers: string[]` (uids), `following: string[]` (uids) — kept in sync as a pair on every follow/unfollow, no separate edge collection

Stats (drive Level — see §9): `postCount`, `supportGiven`, `weeklyPostCount`, `weeklySupportGiven`

Economy: `cybaCoinBalance` (CYBACOIN), `payoutBalance` (real-money-adjacent cash balance, Payout Boost members only)

Membership/boosts: `membershipTier` (`'free' | 'pro' | 'zone_pass' | 'zone_pass_pro' | 'zone_pass_ultimate'`), `payoutEnrolled`, `marketBoost`, `radioBoost`, `spotlightBoost`, `adFreeBoost`, `isCurator` — each boost is a weekly CYBACOIN subscription, see `src/lib/boost-subscriptions.ts` for the billing mechanics
`inventory: { sponsored_post: { quantity }, sponsored_profile: { quantity } }` — one-off Spotlight credits (won from CYBAWHEEL or bought), separate from the recurring `spotlightBoost` subscription flag

Quests/rewards progress: `unlockedQuests: string[]`, `completedQuests: string[]`, `unlockedBackgrounds: string[]`, `purchasedRewards: string[]`

Profile customization: `profileBackground` (id into `src/lib/profile-backgrounds.ts`), `profileBackgroundUrl` (only when `profileBackground === 'custom'`), `anthemUrl`

Payout destination — **heads up, there are two overlapping field pairs in the data today, worth reconciling before mobile ships**: `payoutPlatform` (`'cashapp'|'venmo'`) + `payoutUsername` are set at signup; `cashApp` + `venmo` (plain strings) are what the admin panel edits directly. Check both when reading.

Prefs/moderation: `emailNotifications`, `leaderboardOptOut`, `banned`, `adminAccess: { tabs: string[] }`

Referral: `referralApplied`, `referredBy`, `referralCount`

CYBAWHEEL: `lastWheelSpin`, `bonusSpinsAvailable`

**Subcollections:**
- `users/{uid}/coinTransactions/{id}` — `{ type, amount, description, timestamp }`, CYBACOIN ledger (`type` is a large closed union — see `src/lib/transactions.ts` `TransactionType`)
- `users/{uid}/cashTransactions/{id}` — same shape, cash ledger (`CashTransactionType` in the same file)
- `users/{uid}/adRewardClaims/{adId}` — one doc per Promo Blast ad the user's claimed a watch-reward for, 24h cooldown
- `users/{uid}/referrals/{newUserId}` — `{ username, userId, joinedAt }`
- `users/{uid}/engagementLog/{id}` — `{ type: 'like'|'comment'|'repost', direction: 'inward'|'outward', postId, otherUserId, timestamp }`, server-write only (via `/api/log-engagement`)

### `notifications/{uid}/items/{id}`
`{ type, actorId, actorUsername, actorProfilePictureUrl?, postId?, postSnippet?, commentContent?, message?, linkTo?, read, timestamp }`. `type` is a closed union — see `NotificationType` in `src/lib/notifications.ts` (like, comment, repost, follow, mention, submission_approved, submission_rejected, market_purchase, promo_expiring_soon, promo_renewal_bonus, new_post). **Rules: a user can only read their own notifications** — there's no way for one user to read another's notification list, by design.

### `cybazone_posts/{id}`
The main feed. `{ authorId, authorUsername, authorAvatar, authorProfilePictureUrl, authorLevel, authorPayoutEnrolled, authorSpotlightBoost, authorIsCurator, content, imageUrl?, mediaType: 'image'|'video'|null, mediaItems?: {url,type}[] (multi-media posts, imageUrl/mediaType mirror mediaItems[0]), timestamp, likeCount, likedBy: string[], commentCount, repostCount, repostedBy: string[], hashtags: string[], viewCount, trimStart?, trimEnd?, thumbnailUrl?, videoDurationSeconds?, editedAt?, published?, scheduledAt? }`.

Note the `author*` fields are **denormalized at post-creation time** — see §9, don't expect them to reflect the author's current profile.

Scheduled posts: `published: false` + `scheduledAt` (future Timestamp) + `timestamp` also set to that future time (so it sorts correctly once live). A cron job (`/api/cron/publish-scheduled`) flips `published` at the scheduled time — the mobile client should filter out `published === false` posts whose `scheduledAt` hasn't passed yet when building a feed, same as the web app does.

Subcollection: `cybazone_posts/{id}/comments/{id}` — `{ authorId, authorUsername, ..., content, timestamp, likeCount?, likedBy?, replies? }` (comment likes/replies were added recently — check `src/components/cybazone/CommentSheet.tsx` for the exact current shape).

### `pulses/{id}`
24-hour ephemeral stories. `{ authorId, authorUsername, authorProfilePictureUrl?, authorAvatarConfig?, mediaUrl, mediaType: 'image'|'video', createdAt, expiresAt (24h out), viewedBy: string[] }`. Anyone signed in can mark a pulse viewed (append their uid to `viewedBy`); only the author can otherwise edit/delete. A cron (`/api/cron/cleanup-pulses`) hard-deletes expired docs.

### `ads/{id}` (Promo Blast)
`{ userId, username, mediaUrl, mediaType, buttonText, buttonLink, status: 'pending_payment'|'active'|'expired', tier: 'day7'|'day14'|'day30', durationDays, videoDurationSeconds?, unskippable?, wantsMediaQuest?, wantsCybashirt?, viewCount, clickCount, totalWatchSeconds, expiryWarningSent?, activatedAt?, expiresAt? }`. A client can create its own doc as `status: 'pending_payment'` and can update its own doc *while still pending_payment* (that's also how wallet-cash checkout activates a slot directly, bypassing Stripe) — activating from a real Stripe payment happens server-side only, via the webhook.

### `market_listings/{id}`
`{ sellerId, sellerUsername, title, description, price?: number|null (USD), ccPrice?: number|null, imageUrl?, active: boolean, createdAt }`. (See §8 — the rules gap affecting this collection is systemic, not specific to Market.)

### `merch_orders/{id}`
`{ userId, username, itemId, itemName, paidWith: 'cybacoin'|'wallet_cash', amount, status: 'pending', orderedAt }` — orders against the `merchandise` collection (official CYBAMERCH, admin-managed) and Market listings that were bought with CC/wallet cash go through the "market_purchase" flow instead (a DM to the seller, not this collection — see `handleMarketCCPurchase` / `handleMarketWalletCashPurchase` in `src/app/market/page.tsx`).

### `conversations/{id}`
`{ type: 'direct'|'group', participants: string[], participantInfo: Record<uid, {username, profilePictureUrl, avatarConfig}>, participantKey? (sorted-uid-pair join, direct only, used to find-or-create), name?, lastMessage, lastMessageAt, lastMessageSenderId, unreadCounts: Record<uid, number>, createdAt, createdBy }`. Only participants can read/write.

Subcollection: `conversations/{id}/messages/{id}` — `{ senderId, senderUsername, senderProfilePictureUrl?, senderAvatarConfig?, text, mediaUrl?, mediaType?, sharedPost?: {postId, authorUsername, authorProfilePictureUrl, contentSnippet, imageUrl, mediaType}, sharedPulse?: {pulseId, authorUsername, authorProfilePictureUrl, mediaUrl, mediaType}, createdAt }`.

### `radio_submissions/{id}`
CYBAZONE Radio queue. `{ userId, username, monthKey (YYYY-MM), sourceType?: 'youtube'|'upload', videoId? (youtube), youtubeUrl? (youtube), mediaUrl? (direct upload), title?, submittedAt }`. One active submission per user per month (Radio Boost subscribers only, gated in the UI).

### `quest_submissions/{id}`
Media proof submitted for a CYBAQUEST or a Rewards-page item requiring approval. `{ submissionType: 'quest'|'reward', questId?/questTitle?, rewardId?/rewardName?, payout?: {type:'cybacoin'|'cash', amount}, userId, username, mediaUrl, mediaType, status: 'pending'|'approved'|'rejected', submittedAt, reviewedAt?, reviewNote? }` — admin reviews these; approval credits the payout and fires a `submission_approved` notification.

### `custom_quests/{id}`
Admin-authored CYBAQUESTs (in addition to the ~13 hardcoded tutorial/milestone quests in `src/lib/quests.ts`). See `CustomQuest` in that file for the full shape — includes optional weekly submission-slot limits, a level gate, and an auto-tracked milestone type (`promo_clicks`) that doesn't require manual submission/approval.

### `shoutouts/{id}`, `reviews/{id}`
Feed-injected content types, both admin/user-generated. Shoutouts: auto-fired on milestones (first post, etc.) plus admin-authored, `{ active, expiresAt?, ...text/emoji fields }`. Reviews: `{ userId, username?, rating (1-5), text, anonymous, createdAt }`, publicly readable, created by any signed-in user via the in-app "Write a Review" flow.

### `sponsored_items/{id}`
Spotlight Post / Spotlight Profile activations, redeemed from `inventory` credits. `{ type: 'post'|'profile', userId, postId? (post type only), active, createdAt, expiresAt }`.

### `presence/{sessionId}`
Lightweight "who's active" tracking — write is open to anyone (even signed-out), read requires sign-in.

### `cashout_requests/{id}`, `weekly_payout_history/{id}`
Payout Boost cash-out flow and the historical record of each week's top-CYBA payout run. Both are written by the client (cashout_requests) or the weekly-payout cron (history) — see `src/app/wallet/page.tsx` and `src/app/api/cron/weekly-payout/route.ts`.

### `extras/{id}`, `memberships/{id}`, `merchandise/{id}`
Admin-managed catalog collections: `extras` holds both Rewards-page items (`type: 'reward'`) and Boosts-page cards (`type: 'boost'`); `memberships` = Zone Pass tiers; `merchandise` = official CYBAMERCH. All publicly readable, admin-write only in practice (rules don't enforce that distinction — see the Market caveat above, same pattern here).

### `settings/{docId}` — global config, one doc per key, publicly readable
`ccRates`, `adDropConfig`, `wheelConfig`, `radio` (`{playlistId, active}`, fallback YouTube playlist), `weeklyWinners` (frozen snapshot for the homepage ticker, written by any signed-in user's leaderboard page load once per week — see `src/app/leaderboard/page.tsx`), `rewardsConfig`, `levelConfig`, `boostSubscriptionRates`, `kitchenbot` (unrelated internal counter, ignore).

---

## 5. Firebase Storage

Rule: any signed-in user can write up to 200MB anywhere in the bucket; anyone can read. Path conventions used by the web app (not enforced, just convention — worth following so admin tooling that assumes these paths keeps working):

- `cybazone_uploads/{uuid}[-original-filename]` — post images/videos
- `ad_drop/{uuid}.ext` — Promo Blast creative
- `pulses/{uuid}.ext` — Pulse media
- `radio_uploads/{uuid}.ext` — direct video submissions to CYBAZONE Radio
- `market_listings/{sellerId}/{uuid}.ext` — Market listing photos
- `reward_submissions/{userId}/{timestamp}.ext` — quest/reward proof media
- `messages/{conversationId}/{uuid}.ext` — DM attachments

For a mobile client, upload directly via the native Storage SDK (same as the web app's `uploadBytesResumable` calls) rather than routing through `/api/upload` — see §6 for why.

---

## 6. Client-callable API endpoints

Base URL: `https://cybazone.com` (or the current Firebase App Hosting URL). These are plain REST routes, no auth header scheme — **none of them currently verify the caller's identity via a Firebase ID token**, they trust whatever uid is in the request body. That's a real gap if you're depending on these from an untrusted client; flag it if it matters for your threat model.

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/api/upload` | `{ fileDataUri (base64 data URL), fileName, fileType }` | `{ imageUrl }` | Server-side upload helper. Prefer uploading directly to Storage from the mobile SDK instead — skips the base64 round-trip and this route's lack of auth check. |
| POST | `/api/referral` | `{ newUserId, referrerUsername }` | `{ success, referredBy }` or `{ error }` (404/409/400) | Call once, right after account creation, if the signup form collected a referrer username. Grants 1000 CC to both sides. |
| POST | `/api/log-engagement` | `{ actorId, recipientId, type: 'like'\|'comment'\|'repost', postId }` | `{ logged: true }` or `{ skipped: true }` if actor===recipient | Writes to both users' `engagementLog` subcollections. The web app calls this alongside (not instead of) the actual like/comment/repost write to Firestore. |
| POST | `/api/send-notification-email` | `{ recipientId, type, message?, actorUsername?, linkTo? }` | `{ ok: boolean }` | Fires a transactional email if the recipient has `emailNotifications: true`. The web app's `createNotification()` helper calls this automatically after writing the notification doc — you likely want to mirror that pattern (write the Firestore notification, then best-effort call this) rather than call it standalone. |

---

## 7. NOT for client use

These exist in `src/app/api/` but are not part of the product's client-facing surface — don't call them from the mobile app:

- **`/api/stripe/webhook`** — Stripe payment webhook receiver, signature-verified against Stripe's own signing secret.
- **`/api/cron/*`** (`weekly-payout`, `weekly-reset`, `weekly-boost-billing`, `cleanup-ads`, `cleanup-pulses`, `cleanup-sponsored`, `promo-expiry-warning`, `publish-scheduled`, `launch-reset`) — scheduled jobs, gated behind an `x-cron-secret` header. `launch-reset` in particular is a one-time destructive migration (wipes CYBACOIN/level/quest progress and grants 10k CC to every user) meant to run exactly once at public launch — don't touch it.
- **`/api/admin/trigger-cron`** — relays to the routes above for the admin panel's manual "run now" buttons. Also has no real caller-identity check today (flagged separately to David).
- **`/api/kitchenbot`, `/api/sheets`, `/api/sync-leaderboard`** — unrelated internal tooling sharing this codebase/repo: an ESP32 restaurant kitchen-ticket voice system and a legacy Google Sheets leaderboard sync. Not part of CYBAZONE at all — ignore these entirely.

---

## 8. ⚠ Known Firestore rules gap — read this before building auth-sensitive UI

`firestore.rules` ends with a catch-all:

```
match /{document=**} {
  allow read, write: if isSignedIn();
}
```

Firestore grants an operation if **any** matching rule allows it, and `{document=**}` matches every path in the database — so this one rule runs in parallel with every specific rule above it and, for any signed-in user, overrides all of them. In the rules as currently written, that means any authenticated user can read and write **any** document project-wide: other users' `users/{uid}` profile docs (balance, `banned`, `adminAccess`), anyone's private `notifications`, messages inside DM conversations they aren't a participant of, etc. — regardless of the `isOwner()` / participant checks that appear to restrict those collections above it.

This is a real, currently-live gap (not something introduced for mobile) — it just hasn't mattered much yet because the *web app's own UI* never issues the disallowed writes, so nothing has exercised it. It matters a lot more once a second client exists, because a mobile app is exactly the kind of new, independently-written surface that could either accidentally rely on this over-broad access, or get exploited by a modified/decompiled client that does so on purpose. Worth fixing (removing the catch-all, or narrowing it to `allow read: if isSignedIn()` with no blanket write) before mobile ships, independent of anything else in this doc. This needs sign-off from David and a `firebase deploy --only firestore:rules` from someone with deploy access — flag it to him directly.

Individual collections below are described as if their specific rule is authoritative (that's the *intent*), but per the above, none of the write restrictions are actually enforced against a signed-in user until this is fixed.

## 9. Domain concepts worth knowing before you start

- **Levels** (`spark → charge → surge → storm`) are **computed, not stored** — derived client-side from `postCount`/`supportGiven` against thresholds in `src/lib/levels.ts` (overridable via `settings/levelConfig`). Recompute the same way on mobile; don't look for a `level` field on the user doc.
- **CYBACOIN economy**: earned via posting and engagement (rates in `settings/ccRates`, defaults in `src/lib/cc-rewards.ts`, scaled by the poster's Level), spent on Rewards, CYBAWHEEL spins, and Boosts. `payoutBalance` ("wallet cash") is a separate, real-money-adjacent balance limited to Payout Boost members, cashed out via `cashout_requests`.
- **Denormalization at write time**: post docs snapshot the author's level/avatar/boost flags (`authorLevel`, `authorAvatar`, `authorSpotlightBoost`, `authorIsCurator`, `authorPayoutEnrolled`) at the moment of posting. If the author's profile changes later, old posts keep showing the old snapshot — this is intentional (avoids a live join/listener per post in the feed), not a bug.
- **Boost subscriptions** (Payout, Market, Radio, Spotlight, Ad-Free) are weekly CYBACOIN auto-debits, not one-time purchases — see `src/lib/boost-subscriptions.ts` and the `weekly-boost-billing` cron.
- **Firestore rules file**: `firestore.rules` in the repo root is the actual deployed ruleset (confirm via `firebase deploy --only firestore:rules` history if in doubt — there's a known history of local/deployed drift on this project). Read it directly for the authoritative list of what's allowed; the summaries above are a guide, not a substitute.
