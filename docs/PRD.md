# Product Requirements Document — The Gacker

**Version:** 1.0  
**Status:** Submitted to App Store  
**Platform:** iOS (iPhone only, iOS 15.0+)  
**Motto:** Never Doom.

---

## 1. Overview

The Gacker is a private habit-tracking app built around daily accountability. Each day a user logs whether they stayed clean or had a red day. Over time, entries build into a calendar history, streak counter, and social feed shared only with approved followers.

The name and concept come from the idea of "gacking" a bad habit — logging it honestly rather than ignoring it.

---

## 2. Problem

Most habit trackers are either:
- **Too forgiving** — they let you "freeze" streaks, skip days, or hide failures.
- **Entirely private** — there's no social pressure or shared accountability.
- **Too generic** — not built for a specific, recurring behavioural pattern.

The Gacker solves this by making every day mandatory (you logged it or you didn't), red days visible (not hidden), and progress shareable with a trusted circle.

---

## 3. Goals

| Goal | Metric |
|------|--------|
| Daily logging habit | Users log at least 5 of every 7 days |
| Streak building | Median streak > 7 days after 30 days of use |
| Social retention | Users with ≥1 follower retained at 2× rate vs. solo users |
| App Store approval | Pass review on first submission |

---

## 4. Users

**Primary user:** Someone trying to break or track a recurring habit. They want honest self-accountability, not a tool that lets them off the hook.

**Secondary user:** A friend or accountability partner who follows the primary user and observes their progress.

---

## 5. Features

### 5.1 Authentication
- Phone number + OTP via Supabase Auth
- On first sign-in: profile setup (name, handle, optional avatar)
- On returning sign-in: straight to the app (no setup flash)
- Sign out resets to phone entry screen

### 5.2 Daily Logging (Log tab)
- One entry per day: **Clean** or **Red**
- Optional fields: notes (free text), song (iTunes search), location (GPS → place name)
- Backdated entry via calendar date picker (any past date, no future dates)
- On save: confetti animation (clean) or red screen flash (red)
- Entry can be updated any time

### 5.3 Profile & Calendar (Profile tab)
- Monthly calendar — green dots = clean days, red dots = red days
- Navigate backwards month by month (no future months)
- Pre-launch dates shown as date number (not blocked out)
- Tap any logged day to open Entry Detail sheet (song, notes, timestamp)
- Stats row: current streak, total clean days, total red days

### 5.4 Analytics (Ganalytics tab)
- Streak counter (consecutive clean days ending today)
- All-time clean day count
- All-time red day count
- Fire rate (clean days ÷ total logged days)

### 5.5 Social Feed (Feed tab)
- Chronological feed of entries from approved followers
- Each card shows: user avatar, handle, date label, "X ago" timestamp, clean/red status, song snippet (play button), notes preview, like count, comment count
- Tap like to toggle; tap comment count to open comments sheet
- Tap user avatar/name to open their profile
- Follow requests are approval-gated (private accounts by default)

### 5.6 Follows & Discovery
- Search users by handle
- Send follow request → target approves or denies
- Follower/following lists with slide-up sheet
- Unfollow or remove followers from profile

### 5.7 Notifications
- Follow requests received
- Follow request accepted
- Likes on your entries
- Comments on your entries
- Streak milestones (friend hits 7/30/365 days)
- Unread badge on bell icon
- Mark all read on open

### 5.8 Settings
- Edit display name
- Edit handle (with availability check)
- Change avatar (photo library)
- Sign out
- Delete account (permanent, Apple requirement)

### 5.9 Delete Account
- Confirmation dialog with warning copy
- Calls `delete-account` Edge Function (server-side, uses service role key)
- Deletes: notifications, likes, comments, follows, entries, profile, auth account
- Signs user out on success

---

## 6. Non-functional requirements

| Requirement | Detail |
|-------------|--------|
| Security | RLS enforced on all Supabase tables; service role key never in app bundle |
| Privacy | Accounts are private by default; entries only visible to accepted followers |
| Performance | Feed loads in <1s on LTE; sheet animations at 60fps |
| Offline | Auth state persists across launches; no offline entry creation |
| Accessibility | All interactive elements have tap targets ≥44pt |
| Dark mode | App is permanently dark mode; no toggle |
| iOS version | iOS 15.0 minimum |
| Orientation | Portrait only |

---

## 7. Out of scope (v1.0)

- Android
- Web app
- Push notifications (future: APNs integration)
- Group/challenge features
- Public profiles
- Export / data download
- In-app purchases

---

## 8. Design decisions

**Why approval-gated follows?**  
The content is personal and potentially sensitive. Users must explicitly trust someone before that person can see their history.

**Why no streak freeze?**  
The core philosophy is honesty. A missed day is a missed day. Red days are first-class citizens, not failures to hide.

**Why phone auth instead of email?**  
Lower friction on mobile. No password to forget. OTP takes ~10 seconds.

**Why iTunes instead of Spotify?**  
iTunes Search API requires no OAuth and no user account linking. Song tagging is ambient/optional so the low-friction approach is correct.

**Why permanently dark mode?**  
The emotional tone of the app — accountability, late nights, private reflection — suits a dark UI. Removing the toggle eliminates a whole class of UI state bugs.

---

## 9. Edge cases handled

- Backdated entries (any past date, including before app launch date)
- Logging the same date twice (upsert — overwrites, does not duplicate)
- Viewing your own profile from the Feed (no "Follow" button shown)
- Navigating away with a sheet open (sheets auto-close on tab switch)
- Sign out while on any screen (resets to phone entry cleanly)
- Demo/test account for App Store review (Supabase test phone number)
