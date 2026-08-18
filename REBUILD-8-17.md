# Rebuild plan: branch `8/17`, forked from `main` (418ea416)

What follows is everything branch `8/6` tried to do, split into what was **real work**
(rebuild it) and what was **failed build debugging** (do not rebuild it).

`8/6` = one commit `fd0152f1` on top of main, plus a large pile of uncommitted work.
Nothing on `8/6` was ever confirmed running on device. It is being abandoned, not merged.

---

## Part A — Real feature work (rebuild all of this)

### Step 1. Clean-day goals (schema)
Three migrations under `supabase/migrations/`:

- `20260806000001_add_goal_to_profiles.sql` — adds `clean_day_goal integer` to `profiles`.
- `20260806000002_add_bio_to_profiles.sql` — adds `bio text` to `profiles`.
- `20260806000003_goal_events.sql` — **new table** `goal_events`:
  - `id uuid pk`, `user_id uuid → auth.users on delete cascade`,
    `event_type text check in ('goal_set','goal_met')`, `goal_days integer`, `created_at timestamptz`
  - RLS on. Select policy: any authenticated user. Insert policy: `auth.uid() = user_id`.

### Step 2. Goal + bio editing in Settings
`src/pages/SettingsPage.tsx` — fields for clean-day goal and bio, written to `profiles`.
On setting a goal, fire a `goal_set` event (see step 4).

### Step 3. Goal/bio display on profiles
`src/pages/ProfileTab.tsx`, `src/pages/UserProfile.tsx`, `src/contexts/AuthContext.tsx` —
surface `clean_day_goal` and `bio` on own profile and other users' profiles.

### Step 4. Goal events in the feed + notifications
- `src/lib/social.ts`
  - `FeedItem` gains optional `event_type?: 'goal_set' | 'goal_met'` and `goal_days?: number`.
  - Helper `goalEventsToFeedItems(events, profileMap)` maps a `goal_events` row into a
    `FeedItem` shape (clean: true, no likes/comments, `date` = `created_at.slice(0,10)`).
  - `getFeed` and `getMyActivity` each query `goal_events` alongside `entries`, then
    merge and sort both lists by `created_at` descending.
  - **Important bug fix baked in here:** both functions used to `return []` early when
    the user had zero entries, which would have hidden goal events. They now guard only
    the likes/comments lookup on `entryIds.length > 0` and keep going.
  - New `postGoalEvent(userId, eventType, goalDays, followerIds)` — inserts the
    `goal_events` row and inserts one notification row per follower (excluding self).
- `src/lib/notifications.ts` — `NotificationType` gains `'goal_set' | 'goal_met'`.
- `src/pages/NotificationsPage.tsx` — copy for both:
  `"{handle} just set a {n} day goal!"` / `"{handle} just hit their {n} day goal! 🎉"`.
- `src/components/FeedCard.tsx` — early-return branch rendering a compact goal card
  (avatar + one line + timeAgo, no like/comment row) when `item.event_type` is set.
- `src/pages/LogTab.tsx` — after a clean-day log, read `profiles.clean_day_goal`; if the
  new streak `=== goalDays` exactly, call `postGoalEvent(..., 'goal_met', ...)`.

### Step 5. Streak fix
`src/lib/entries.ts` + `src/components/CalendarView.tsx` — streak computation correction.

### Step 6. Swipe-aware taps (`useTap`)
**New file `src/hooks/useTap.ts`** — the core of this branch's UX work.

Problem: everything used `onPointerDown` + `preventDefault` to get instant taps, but that
fires during a scroll gesture, so scrolling a list would trigger whatever you dragged over.

`useTap(handler)` returns `{ props }` — pointer-down records the origin, pointer-move
cancels if travel exceeds a small threshold, pointer-up fires the handler only if not
cancelled. `useTapList()` returns a factory `tapList(key, handler)` for rows in a list.

Converted to `useTap`/`useTapList`:
- `src/pages/FeedTab.tsx` — notification bell, "find friends"
- `src/components/FeedCard.tsx` — song play/pause, comments
- `src/components/EntryDetailSheet.tsx` — song play/pause
- `src/components/LikedSongsSheet.tsx` — row select, unlike, preview
- `src/components/ProfileTabs.tsx` — heart/like on song rows
- `src/pages/GanalyticsTab.tsx`, `src/lib/social.ts` — misc call sites

Note: nested buttons inside a tappable row wrap the handlers to `stopPropagation()` first,
so the inner control wins over the row. That is written inline as an IIFE in several
places and is ugly — worth extracting into `useTap` itself during the rebuild.

### Step 7. Liked Songs sheet — swipe to dismiss
`src/components/LikedSongsSheet.tsx` — same `useSwipeToDismiss(handleClose, scrollRef)`
hook the other sheets use, so the sheet drags away downward.

### Step 8. Entry detail sheet portals to body
`src/components/EntryDetailSheet.tsx` — wraps its return in
`ReactDOM.createPortal(sheet, document.body)` so the fixed overlay escapes any
transformed/overflow ancestor.

### Step 9. Photos subtab pinned to bottom
`src/components/ProfileTabs.tsx` — layout fix so the Photos grid reaches the bottom of
the screen instead of stopping short.

### Step 10. Sisyphus animation on Ganalytics
`src/pages/GanalyticsTab.tsx` (largest single change) + `src/App.tsx`
(`<GanalyticsTab isActive={activeTab === 'ganalytics'} />`).

An inline SVG of a man pushing a boulder up a mountain, driven by goal progress `p` (0–1).
Requirements as settled with the user:

- **Coordinate system:** `y = 0` is the slope surface; the body extends upward into
  negative `y`. Hip at `(0, -22)`, shoulders at `(5, -29)`, head circle at `(10, -36) r=5`.
- **Boulder sits on the ground, not floating:** `bx = 30, by = -14, br = 14` — i.e.
  `by === -br` is what makes it touch the slope. Keep that identity.
- **Man is small** relative to the boulder, and stands *on top of* the left slope line,
  not through it.
- **Bent at the hips** so his hands actually reach the boulder — torso is a curved path
  from hip to shoulder, two arms reaching forward to the boulder surface.
- **Resting only at the very start:** `const isResting = p < 0.03;` — do **not** also rest
  near `p > 0.97`; at 100% the walk animation must still play.
- **Boulder rolls down the right slope once at the top.** One boulder, never two:
  - `showFall = p > 0.97`
  - the pushed boulder gets an id and a hide keyframe that flips opacity at 98–100% of the
    push duration
  - the falling boulder starts at `opacity: 0` and uses
    `animation-fill-mode: forwards` — **not `both`**. With `both`, the `from` keyframe
    (opacity 1) applies during the delay and you get a ghost boulder parked at the peak.
    This was the exact bug the user caught. Do not reintroduce it.
  - its rotation is an SVG `animateTransform` with `begin="${moveDurSec}s"`,
    `fill="freeze"`, `repeatCount="1"` so it rotates once and stops, in sync with the
    CSS translate whose `animation-delay` is the same `moveDurSec`.
  - `moveDurSec = Math.max(1.8, 1.8 + p * 2.2)`, fall duration `1.6s` ease-in,
    fall target `RX = 292, RY = 152`, rotation ≈ `683deg` (tuned to the right-slope length).

### Step 11. iOS project metadata
`ios/App/App.xcodeproj/project.pbxproj` — `CURRENT_PROJECT_VERSION` 2 → 3,
`MARKETING_VERSION` 1.0.0 → 1.1.0, and `TARGETED_DEVICE_FAMILY` unquoted (`"1"` → `1`).
Keep these. Bundle id stays `com.sahilvyas.thegacker` (already on main; unchanged).

---

## Part B — The build failures, and what actually fixed them

Two genuinely separate problems got tangled together. Only the first was ever solved.

### B1. Xcode 26.3 could not resolve Swift packages — SOLVED, keep the fix

Symptom: `Could not resolve package dependencies` / `swift-tools-version 3.1.0 is not supported`.

Three independent causes, all needed fixing:

1. **Capacitor 8.4.1's `capacitor-swift-pm` declares `swift-tools-version:5.3`**, which
   Xcode 26.3 dropped support for. Fix: bump all Capacitor packages to **8.5.0**
   (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`, `@capacitor/cli`,
   `@capacitor/camera` 8.2.2, `@capacitor/geolocation` 8.2.1). `npx cap sync ios` then
   rewrites `ios/App/CapApp-SPM/Package.swift` to pin `capacitor-swift-pm` `exact: "8.5.0"`.
2. **`node_modules/@capacitor/app/Package.swift` had a stray `q` character** at byte 0 —
   the file literally began `q// swift-tools-version: 5.9`, so SPM could not parse the
   version line and fell back to 3.1.0. Almost certainly a stray keystroke saved into
   the file at some point. It is currently fixed in `node_modules`, but a fresh
   `npm install` will restore the published (correct) file, so this should not recur.
   **If the 3.1.0 error ever comes back, check the first bytes of that file first.**
3. **Stale caches.** Delete
   `ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved`
   and `~/Library/Developer/Xcode/DerivedData/App-*` and let both regenerate. Xcode had
   a cached `capacitor-swift-pm` checkout still on the old tools version, so it kept
   building against 5.3 long after the packages were bumped — a real trap, worth
   re-clearing DerivedData any time package versions change.

### B2. Blank white/dark screen on launch — NOT SOLVED

Symptom: app shows for a split second, then goes blank. Xcode console:

```
------ STARTUP JS ERROR ------
ReferenceError: Cannot access 'R' before initialization
URL: capacitor://localhost/assets/index-<hash>.js
```

A JS temporal-dead-zone error inside the production bundle, thrown by WKWebView's
JavaScriptCore. Everything below was tried and **none of it fixed the blank screen**:

| Attempt | Result |
| --- | --- |
| `manualChunks` splitting React + Radix into `react-vendor` / `radix-vendor` | `R` error moved to a `T` error in `react-vendor` |
| `@originjs/vite-plugin-commonjs` | byte-identical output, no effect |
| `inlineDynamicImports: true` + `hoistTransitiveImports: false` | `R` error returned |
| `manualChunks` for Radix only + `hoistTransitiveImports: false` | still blank |
| `generatedCode: { constBindings: false }` | still blank |
| Changing `capacitor.config.ts` `appId` to match the Xcode bundle id | wrong turn — the mismatch is pre-existing on main and main runs fine. **Revert this.** |

**Do not rebuild any of the above.** Every one of those `vite.config.ts` experiments and
the `@originjs/vite-plugin-commonjs` dependency should be dropped. `8/17` starts with
main's plain `vite.config.ts`.

**What is actually known:**

- A build from **July 5** (bundle id `com.gacker.app`, still installed on the simulator)
  runs fine. It is a plain single bundle with no `build` config at all.
- No circular imports exist in `src/` — verified by a full import-graph scan of all 108
  TS/TSX files, zero cycles. So the TDZ originates in `node_modules`, not app code.
- Therefore the prime suspect is the **dependency change**, i.e. the Capacitor
  8.4.0 → 8.5.0 bump (and whatever transitive updates `package-lock.json` picked up —
  that diff is ~495 lines), not any of the feature work.

**The one experiment that was never run, and should be step 1 of debugging on `8/17`:**

> Build **pristine main** against the **current `node_modules`**. If the `R` error appears
> there too, the cause is the dependency bump and the fix is on the dependency side
> (pin back, or bump Radix/React deliberately) — and none of the feature work is implicated.
> If pristine main is clean, bisect the feature work back in file by file.

Splitting the two concerns is the whole point of this rebuild: `8/6` mixed feature work
and build debugging into one unrunnable pile, so neither could be evaluated.

---

## Part C — Do not carry any of this over

- `vite.config.ts` — all `build.rollupOptions` experiments (use main's file verbatim)
- `@originjs/vite-plugin-commonjs` in `package.json`
- `capacitor.config.ts` `appId` change (`com.gacker.app` is correct, leave it)
- `build/` — untracked build output that got committed into the working tree
- `ios/App/App/config 2.xml` — a duplicate file from a bad sync; delete
- Any `* 2.js` / `assets 2/` / `index 2.html` duplicates under `ios/App/App/public/`.
  If these appear, delete `ios/App/App/public/` entirely and re-run
  `npm run build && npx cap sync ios`.

## Deploy loop

```
npm run build && npx cap sync ios
```

then Run ▶ in Xcode. Clear `~/Library/Developer/Xcode/DerivedData/App-*` whenever
package versions change.
