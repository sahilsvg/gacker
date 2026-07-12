# C4 Level 2 — Containers

> What are the deployable/runnable units inside the system?

```mermaid
C4Container
    title Container Diagram — The Gacker

    Person(user, "User", "iPhone running iOS 15+")

    Container_Boundary(app, "iOS App (Capacitor)") {
        Container(webview, "React Web App", "React 18, TypeScript, Tailwind CSS, Vite", "All UI and business logic. Runs inside a WKWebView managed by Capacitor.")
        Container(native, "Capacitor Native Shell", "Swift / iOS", "Bridges the WebView to native iOS APIs: camera, GPS, keyboard, haptics.")
    }

    Container_Boundary(supabase_boundary, "Supabase (managed cloud)") {
        ContainerDb(postgres, "Postgres Database", "PostgreSQL 17", "Stores profiles, entries, follows, likes, comments, notifications. RLS enforced.")
        Container(auth, "Supabase Auth", "GoTrue", "Phone OTP auth. Issues JWTs. Manages sessions.")
        Container(storage, "Supabase Storage", "S3-compatible", "Avatar image uploads. Public bucket with per-user paths.")
        Container(edge_delete, "delete-account function", "Deno (Edge Runtime)", "Deletes all user data and auth account using service role key. JWT-verified.")
        Container(edge_itunes, "itunes-search function", "Deno (Edge Runtime)", "Proxies iTunes Search API. No JWT required.")
        Container(edge_geo, "reverse-geocode function", "Deno (Edge Runtime)", "Converts lat/lng to place name. No JWT required.")
        Container(realtime, "Supabase Realtime", "Phoenix Channels", "Pushes live DB changes to subscribed clients (feed refresh).")
    }

    System_Ext(itunes_api, "iTunes Search API", "Apple")
    System_Ext(geocoding_api, "Geocoding API", "Third-party")
    System_Ext(sms, "SMS Gateway", "Twilio via Supabase")

    Rel(user, webview, "Taps, swipes, types", "Touch / WKWebView")
    Rel(webview, native, "Camera, GPS, keyboard, haptics", "Capacitor Plugin Bridge")
    Rel(webview, auth, "Sign in with phone OTP, refresh token", "HTTPS / Supabase JS")
    Rel(webview, postgres, "Read/write entries, profiles, social data", "HTTPS / PostgREST (anon key + JWT)")
    Rel(webview, storage, "Upload avatar image", "HTTPS / Supabase Storage API")
    Rel(webview, edge_delete, "Delete account request (JWT)", "HTTPS / supabase.functions.invoke")
    Rel(webview, edge_itunes, "Song search query", "HTTPS / supabase.functions.invoke")
    Rel(webview, edge_geo, "Reverse geocode lat/lng", "HTTPS / supabase.functions.invoke")
    Rel(webview, realtime, "Subscribe to feed updates", "WebSocket")
    Rel(edge_delete, postgres, "Delete all user rows", "Postgres (service role, bypasses RLS)")
    Rel(edge_delete, auth, "Delete auth.users record", "Supabase Admin API")
    Rel(edge_itunes, itunes_api, "Forward search query", "HTTPS")
    Rel(edge_geo, geocoding_api, "Forward lat/lng", "HTTPS")
    Rel(auth, sms, "Send OTP code", "Twilio API")
```

## Key design decisions

### Why no custom backend?
Supabase's PostgREST + RLS combination lets the app talk directly to the database safely. There's no business logic complex enough to require a dedicated API server. The three Edge Functions handle the only cases where a server-side step is unavoidable (service role key access, third-party API proxying).

### Why Edge Functions for iTunes and geocoding?
Keeping third-party API calls server-side means:
- API keys (if ever needed) never ship in the app bundle
- The app's network footprint is a single domain (Supabase)
- Rate limiting and caching can be added in one place later

### Why Capacitor instead of React Native?
The team is web-native. Capacitor lets 100% of the UI be standard React/TypeScript with zero native Swift code beyond the Capacitor scaffold. Native features (camera, GPS, keyboard, haptics) are accessed through well-maintained Capacitor plugins.
