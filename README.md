# Brewbook

A personal coffee brew log, mobile-first. One brew ticket per bag; adjust, time, rate, tag.

- `services/web` — React + Vite SPA (the design lives in `src/styles.css` and the screens)
- `services/api` — .NET 10 minimal API, EF Core, Postgres
- `proxy` — stock [oauth2-proxy](https://oauth2-proxy.github.io/oauth2-proxy/) with Google sign-in, fronting both
- `.railway/railway.ts` — the Railway project as code; `.railway/README.md` is the deployment runbook

`AGENTS.md` describes the product rules, layout and conventions.

## Run locally

Whole stack, no Google account needed (an nginx `edge` service stamps a fixed identity):

```bash
docker compose up --build
open http://localhost:3000
```

Fast inner loop: Postgres from compose, API and web from source.

```bash
docker compose up postgres -d
cp .env.example .env

# api → http://localhost:8080
cd services/api/src/Brewbook.Api && DATABASE_URL=postgres://brewbook:brewbook@localhost:5432/brewbook PORT=8080 dotnet run

# web → http://localhost:5173 (vite proxies /api to the api with fake identity headers)
cd services/web && npm install && npm run dev
```

Tests: `dotnet test services/api/Brewbook.slnx` and `cd services/web && npm test`.

## How auth works

```
browser ──► oauth2-proxy (Google OIDC) ──► /api/*  → api   (private network)
                                       └──► /*     → web   (private network)
```

Unauthenticated requests get the Google login. Authenticated ones are forwarded with
`X-Auth-Request-Email`; the API creates the user on first sight and scopes everything to them.
The API refuses requests without that header and must never be exposed directly.

Sign out: `/oauth2/sign_out`.

## Google Cloud Console setup

Two things come from Cloud Console: the OAuth client that oauth2-proxy signs people in with, and
the Gemini API key the API uses to read bag labels and transcribe voice. Both live in one project.

### 1. OAuth client for sign-in (required)

1. Create or pick a project at https://console.cloud.google.com.
2. **APIs & Services → OAuth consent screen**: External, app name "Brewbook", your email as
   support and developer contact. No scopes beyond the defaults (`openid`, `email`, `profile`).
   Publish the app, or add yourself as a test user while it is in Testing.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type *Web application*.
   - Authorised JavaScript origin: `https://<proxy domain>`
   - Authorised redirect URI: `https://<proxy domain>/oauth2/callback`
4. Copy the client ID and secret into the `proxy` service on Railway as
   `OAUTH2_PROXY_CLIENT_ID` and `OAUTH2_PROXY_CLIENT_SECRET`. The service redeploys itself.

`<proxy domain>` is the Railway domain on the `proxy` service (Settings → Networking), for
example `proxy-production-xxxx.up.railway.app`, or a custom domain you attach there.

### 2. Gemini API key for label reading and voice (optional)

1. **APIs & Services → Library**: enable **Generative Language API** (`generativelanguage.googleapis.com`).
2. **APIs & Services → Credentials → Create credentials → API key**. Restrict it:
   - API restrictions: *Restrict key* → Generative Language API only.
   - Application restrictions: *None* (the key is used server-side from Railway, not from a browser).
3. Billing must be enabled on the project for anything beyond the free tier.
4. Put the key on the `api` service on Railway as `GEMINI_API_KEY`.

The model defaults to `gemini-2.5-flash` (fast, cheap, handles images and audio). Override with
`Gemini__Model` on `api` to move to a newer Gemini release; nothing else changes.

| Variable (on `api`) | Effect |
|---|---|
| `GEMINI_API_KEY` | Label scans are read into the confirm-bag ledger, and the SPEAK button records audio that the API transcribes. Without it the scan screen says label reading is not configured and voice falls back to the browser's own speech recogniser (Chrome, Safari). |
| `Gemini__Model` | Optional model override. |

The transcript is always parsed into a ticket delta by a deterministic rule set on the API
(`Features/Voice/VoiceCommandParser.cs`), so the same words give the same change regardless of
which recogniser produced them.
