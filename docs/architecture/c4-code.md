# C4 Level 4 — Code

> Key implementation patterns. Not exhaustive — focuses on the non-obvious decisions.

---

## Auth state machine (`App.tsx`)

The app has four auth steps managed by a single `authStep` state:

```
'phone' → 'otp' → 'setup' → 'welcome' (then app shell)
```

```typescript
// Detects sign-out by comparing previous user ref to current
const prevUser = useRef<User | null>(null);
useEffect(() => {
  if (prevUser.current && !user) {
    // User just signed out — reset to phone entry
    setAuthStep('phone');
    setPendingPhone('');
    setShowWelcome(false);
  }
  prevUser.current = user;
}, [user]);

// Profile setup only shown when explicitly in setup step
// (not when profile hasn't loaded yet — avoids flash on returning users)
if (authStep === 'setup') return <ProfileSetup ... />;
```

**Why a ref instead of state for prevUser?**
Putting previous user in state would cause an extra render cycle. A ref update is synchronous and doesn't re-render.

---

## Sheet animation pattern

Every bottom sheet uses the same `isClosing` pattern to play a slide-down animation before unmounting:

```typescript
const [isClosing, setIsClosing] = useState(false);

const handleClose = () => {
  setIsClosing(true);
  setTimeout(onClose, 210); // matches animation duration
};

// In JSX:
<div className={isClosing ? 'animate-slide-down' : 'animate-slide-up'}>
```

CSS (index.css):
```css
@keyframes slide-up {
  from { transform: translateY(48px); opacity: 0; }
  to   { transform: translateY(0);    opacity: 1; }
}
@keyframes slide-down {
  from { transform: translateY(0);    opacity: 1; }
  to   { transform: translateY(48px); opacity: 0; }
}
.animate-slide-up   { animation: slide-up   0.28s cubic-bezier(0.32, 0.72, 0, 1) both; }
.animate-slide-down { animation: slide-down 0.22s cubic-bezier(0.32, 0.72, 0, 1) both; }
```

**Why not CSS transitions?**
Transitions require the element to already be mounted with a starting state. Keyframe animations apply immediately on class add, which is what we need since the element is being added/removed from the DOM.

---

## CommentsSheet portal

`FeedCard` applies CSS transforms for its press animation. CSS transforms create a new [containing block](https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block), which means `position: fixed` children are positioned relative to the card, not the viewport. `CommentsSheet` (which needs to cover the full screen) would otherwise be clipped to the card bounds.

Fix: render the sheet outside the card's DOM subtree entirely.

```typescript
// CommentsSheet.tsx
import { createPortal } from 'react-dom';

const sheet = (
  <div className="fixed inset-0 z-[200] flex flex-col justify-end">
    ...
  </div>
);

return createPortal(sheet, document.body);
```

---

## RLS policy: entries visibility

A user can read an entry if they own it, or if they have an accepted follow relationship with the owner:

```sql
CREATE POLICY "entries_select"
  ON public.entries FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid()
        AND following_id = entries.user_id
        AND status = 'accepted'
    )
  );
```

This means the PostgREST query in `getFeed()` — which passes a list of `followingIds` — works correctly even without server-side filtering, because the DB rejects any rows the caller isn't allowed to see.

---

## Delete account flow

The service role key never touches the device. The flow:

```
App                          Edge Function (Deno)          Supabase Admin
 │                                │                              │
 │─ supabase.functions.invoke ───►│                              │
 │  (user JWT in header)          │                              │
 │                                │─ anonClient.auth.getUser() ─►│
 │                                │◄─ { user } ─────────────────│
 │                                │                              │
 │                                │─ adminClient.from('entries') │
 │                                │   .delete().eq('user_id')   │
 │                                │  (+ 5 other tables)          │
 │                                │                              │
 │                                │─ adminClient.auth.admin      │
 │                                │   .deleteUser(uid) ─────────►│
 │◄─ { success: true } ──────────│                              │
```

The Edge Function uses two separate Supabase clients:
- `anonClient` with the user's JWT to verify identity
- `adminClient` with `SUPABASE_SERVICE_ROLE_KEY` (env var on Supabase's servers) to bypass RLS for deletion

---

## Auto-close sheets on tab switch

Each tab receives an `isActive: boolean` prop that goes `false` when the user navigates away. Sheets watch this prop and close themselves:

```typescript
// FeedCard.tsx
useEffect(() => {
  if (!isTabActive) {
    setShowComments(false);
    setShowLikes(false);
  }
}, [isTabActive]);
```

This prevents the UX bug where a comment sheet opened on the Feed tab would still be visible when the user returned to the Profile tab.
