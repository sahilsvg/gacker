# C4 Level 1 — System Context

> Who uses the system and what external systems does it talk to?

```mermaid
C4Context
    title System Context — The Gacker

    Person(user, "Gacker User", "Tracks daily habits, follows friends, views feed")

    System(gacker, "The Gacker", "iOS habit-tracking app with private social feed")

    System_Ext(supabase, "Supabase", "Managed Postgres database, Auth (phone OTP), file storage, Edge Function runtime")
    System_Ext(apple_auth, "Apple / App Store", "OTP SMS delivery via Supabase Auth, app distribution")
    System_Ext(itunes, "iTunes Search API", "Song and artist search for entry tagging (no auth required)")
    System_Ext(geocoding, "Geocoding Service", "Reverse geocodes GPS coordinates to human-readable place names")

    Rel(user, gacker, "Logs days, views feed, follows friends", "Capacitor iOS WebView")
    Rel(gacker, supabase, "All data reads and writes, auth tokens, avatar uploads", "HTTPS / Supabase JS client")
    Rel(gacker, itunes, "Song search queries", "HTTPS via Edge Function proxy")
    Rel(gacker, geocoding, "Reverse geocode on location pin", "HTTPS via Edge Function proxy")
    Rel(supabase, apple_auth, "Sends OTP SMS to user's phone number", "Twilio / SMS gateway")
```

## Notes

- The iOS app is a **WebView shell** — the UI is a React web app compiled and loaded inside a Capacitor native container. There is no separate native Swift UI.
- **All data flows through Supabase** — there is no custom API server. The app talks directly to Supabase's PostgREST endpoint using the anon key, with Row Level Security enforcing access control.
- iTunes Search and geocoding are proxied through **Supabase Edge Functions** so the app never calls those third-party APIs directly (keeps the network surface minimal and allows future auth/rate-limiting).
- SMS delivery for OTP is handled by **Supabase Auth's built-in Twilio integration** — the app never touches a phone number after submitting it.
