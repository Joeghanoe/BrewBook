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

## Optional integrations

| Variable (on `api`) | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Label scans are read by Claude vision. Without it, the scan screen says label reading is not configured and the bag is entered by hand. |

Voice commands use the browser's speech recogniser (Chrome, Safari); the API turns the transcript
into a ticket delta with a deterministic parser (`Features/Voice/VoiceCommandParser.cs`).
