# The Gacker

> **Never Doom.** A private habit tracker with a social layer — log a clean day, keep your streak. Log a red day, own it.

iOS app built with React + TypeScript + Vite, wrapped in Capacitor, backed by Supabase.

---

## What it does

- **Daily logging** — mark each day clean or red. Add notes, tag a song, pin a location.
- **Calendar history** — full visual record of your past, colour-coded by day type.
- **Streaks & stats** — current streak, total clean days, total red days, fire rate.
- **Private social feed** — follow friends (approval-gated), see their entries in chronological order, like and comment.
- **Notifications** — follow requests, likes, comments, streak milestones.
- **Delete account** — full in-app data deletion (Apple App Store requirement).

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + TypeScript + Tailwind CSS |
| Build | Vite |
| Native wrapper | Capacitor 6 (iOS) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Auth | Phone number OTP (Supabase Auth) |
| Music search | iTunes Search API (via Edge Function) |
| Geocoding | Reverse geocode Edge Function |

---

## Project structure

```
src/
├── pages/
│   ├── auth/               # PhoneEntry, OTPVerify, ProfileSetup, WelcomeBack
│   ├── LogTab.tsx          # Daily logging — clean/red, notes, song, location
│   ├── ProfileTab.tsx      # Your calendar + stats + settings
│   ├── FeedTab.tsx         # Social feed of people you follow
│   ├── GanalyticsTab.tsx   # Streak chart and lifetime analytics
│   ├── UserProfile.tsx     # Another user's public profile
│   ├── NotificationsPage.tsx
│   ├── SettingsPage.tsx    # Edit profile, sign out, delete account
│   └── FollowRequestsPage.tsx
├── components/
│   ├── CalendarView.tsx    # Month grid with clean/red day colours
│   ├── DatePickerSheet.tsx # Backdated entry picker
│   ├── EntryDetailSheet.tsx
│   ├── CommentsSheet.tsx
│   ├── FeedCard.tsx
│   ├── LikesSheet.tsx
│   ├── FollowListSheet.tsx
│   ├── SongPicker.tsx      # iTunes search
│   ├── LocationPicker.tsx
│   └── SplashScreen.tsx
├── lib/
│   ├── entries.ts          # Entry CRUD + stats computation
│   ├── social.ts           # Feed, follows, likes, comments, search
│   ├── notifications.ts    # Notification read/write
│   ├── timeAgo.ts          # Relative timestamp utility
│   └── validation.ts       # Handle + name sanitisation
├── contexts/
│   └── AuthContext.tsx     # User session + profile state
└── App.tsx                 # Auth gate → splash → tab shell

supabase/
├── functions/
│   ├── delete-account/     # Deletes all user data via service role key
│   ├── itunes-search/      # Proxies iTunes Search API
│   └── reverse-geocode/    # Converts lat/lng to place name
└── migrations/             # All schema and RLS changes

ios/                        # Xcode project (Capacitor-generated)
```

---

## Database tables

| Table | Description |
|-------|-------------|
| `profiles` | id, name, handle, avatar_url |
| `entries` | user_id, date, clean, notes, song_*, location_*, created_at |
| `follows` | follower_id, following_id, status (pending/accepted) |
| `likes` | user_id, entry_id |
| `comments` | user_id, entry_id, body, created_at |
| `notifications` | user_id, actor_id, type, data, read |

Row Level Security is enabled on all tables. See `supabase/migrations/` for full policy definitions.

---

## Running locally (web)

```bash
npm install
npm run dev
# opens at http://localhost:8080
```

Copy `.env.example` to `.env` and fill in your Supabase project URL and publishable key.

---

## Running on iOS simulator

Requires Xcode (free from Mac App Store).

```bash
npm run build
npx cap sync ios
npx cap open ios
# hit Play in Xcode with an iPhone simulator selected
```

After any code change: `npm run build && npx cap sync ios`

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Your Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key (safe to ship in app) |

The service role key is never stored in the app — it lives only in the Supabase Edge Function runtime.

---

## App Store

- **Bundle ID:** `com.sahilvyas.thegacker`
- **Platform:** iPhone only (iOS 15.0+)
- **Demo account for review:** phone `+1 (415) 555-1234`, OTP `123456`

---

## Docs

- [`docs/PRD.md`](docs/PRD.md) — Product Requirements Document
- [`docs/architecture/`](docs/architecture/) — C4 architecture diagrams
