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
`X-Forwarded-Email`; the API creates the user on first sight and scopes everything to them.
The API refuses requests without that header and must never be exposed directly.

Sign out: `/oauth2/sign_out`.

## Google Cloud Console setup

Three things come from Cloud Console: the OAuth client that oauth2-proxy signs people in with, the
Gemini API key the API uses to read bag labels and transcribe voice, and two Maps Platform keys for
the roaster map. All live in one project.

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
2. **APIs & Services → Credentials → Create credentials → API key**:
   - API restrictions: *Restrict key* → Gemini API only.
   - Newer projects require the key to be **bound to a service account** ("Authenticate API calls
     through a service account"). Accept the default account or pick one, then make sure that
     service account has the **Generative Language API User** role (IAM & Admin → IAM). Without it
     the API answers 403 and the app reports the label as unreadable.
   - Application restrictions: *None* (the key is used server-side from Railway, not from a browser).
3. Billing must be enabled on the project for anything beyond the free tier.
4. Put the key on the `api` service on Railway as `GEMINI_API_KEY`. The service redeploys itself.
5. Scan a label. If it comes back unread, the `api` deploy logs on Railway show the Gemini status
   code and message.

The model defaults to `gemini-3.6-flash` (fast, cheap, handles images and audio). Override with
`Gemini__Model` on `api` to move to a newer Gemini release; nothing else changes.

| Variable (on `api`) | Effect |
|---|---|
| `GEMINI_API_KEY` | Label scans are read into the confirm-bag ledger, and the SPEAK button records audio that the API transcribes. Without it the scan screen says label reading is not configured and voice falls back to the browser's own speech recogniser (Chrome, Safari). |
| `Gemini__Model` | Optional model override. |

The transcript is always parsed into a ticket delta by a deterministic rule set on the API
(`Features/Voice/VoiceCommandParser.cs`), so the same words give the same change regardless of
which recogniser produced them.

### 3. Maps Platform keys for the roaster map (optional)

The Roasters screen (Library → MAP) puts every roaster you have logged on a map, sized by your
average rating of its bags and searchable by the flavours you liked. It needs two keys with
different restrictions: one the API uses to find roasters, one the browser uses to draw the map.
The browser key is fetched from `/api/v1/config` at runtime; nothing is baked into the SPA.

1. **APIs & Services → Library**: enable **Places API (New)** (`places.googleapis.com`) and
   **Maps JavaScript API** (`maps-backend.googleapis.com`). The legacy "Places API" is not used.
2. **Server key** — Credentials → Create credentials → API key, name it `brewbook-server`:
   - Application restrictions: *None* (called from Railway, not a browser).
   - API restrictions: *Restrict key* → **Places API (New)** only.
   - Put it on the `api` service on Railway as `GOOGLE_MAPS_SERVER_KEY`.
3. **Browser key** — Credentials → Create credentials → API key, name it `brewbook-browser`:
   - Application restrictions: *Websites*, with the proxy domain as the referrer:
     `https://<proxy domain>/*` (add `http://localhost:5173/*` for local development).
   - API restrictions: *Restrict key* → **Maps JavaScript API** only.
   - Put it on the `api` service on Railway as `GOOGLE_MAPS_BROWSER_KEY`.
4. Billing must be enabled on the project. Places text search is billed per request; the API
   asks once per roaster and stores the answer, so a personal log makes a handful of calls in
   total. Maps JavaScript API loads are billed per map load, within the monthly free credit for
   personal use.
5. Open the map. A roaster the search could not place is listed under "Not on the map"; open it
   and use **FIND IT** (or **WRONG PLACE?** on a mislocated one) to name the place yourself.

| Variable (on `api`) | Effect |
|---|---|
| `GOOGLE_MAPS_SERVER_KEY` | Roasters are located with Places API (New) the first time the map asks for them; the answer is cached on the roaster. Without it every roaster reports itself as not located and `POST /api/v1/roasters/{id}/relocate` answers 503. |
| `GOOGLE_MAPS_BROWSER_KEY` | Handed to the SPA through `/api/v1/config`. Without it the Roasters screen shows the list only. |

Roasters are shared rows keyed by normalised name (trim, casefold, collapse spaces); ratings and
flavour tags stay per user. The location comes from Google or from nobody: an unconfigured or
failed lookup leaves the roaster unlocated rather than guessing.

## Friends, invitations and shared recipes (off by default)

The whole friends surface — inviting, accepting, a friend's roasters on your map, their recipes on
your ticket — is one capability behind one switch, and it is **off** unless a deployment turns it
on:

```
Features__Friends=true      # on the `api` service
```

Off means the routes are not there: `/api/v1/friends/*` is 404, `/api/v1/roasters` ignores
`?scope=` and answers with your own map, and recipes are unreadable. `/api/v1/me` reports
`features.friends`, so the client drops the FRIENDS tab, the map's scope control, the sharing
setting and the per-brew private toggle rather than showing controls that cannot do anything.
Nothing is deleted while it is off: friendships, invitations and brew privacy all keep their rows.

Email (below) is gated by this too — with friends off, nothing is ever posted to anyone.

## Cloudflare Email Sending for friend invitations (optional)

A friendship starts with an invitation. The invitation is a row and a token whatever happens next:
the sender always gets a link they can pass on themselves, and an invitation addressed to an email
is also waiting in Brewbook the next time that person opens it. Configuring this only adds one
thing — the invitation also arrives by mail.

Email Sending is a Cloudflare Email Service feature. It needs a **Workers Paid** plan and a sender
domain onboarded through the Cloudflare dashboard, which provisions the SPF, DKIM and bounce
records for you.

0. Turn the friends capability on first (above). Without it the mailer is never even constructed.
1. **Cloudflare dashboard → Email Service → Email Sending**: onboard the domain you will send from
   and let it write the DNS records.
2. **My Profile → API Tokens → Create token** with permission to send email on that account. Put it
   on the `api` service on Railway as `CLOUDFLARE_EMAIL_TOKEN`.
3. Set `Email__AccountId` (the Cloudflare account id), `Email__From` (an address on the onboarded
   domain, e.g. `invites@example.com`) and `Email__PublicUrl` (the **proxy** service's public
   domain — an invitation link has to land where people sign in, not on `api` or `web`).
4. All four must be set or the feature stays off. `/api/v1/me` reports `features.emailInvites`, and
   the friends screen says which of the two paths the user is getting.

| Variable (on `api`) | Effect |
|---|---|
| `CLOUDFLARE_EMAIL_TOKEN` | The API token that authorises sending. |
| `Email__AccountId` | Cloudflare account id in the send URL. |
| `Email__From` | Sender address; must be on a domain onboarded for Email Sending. |
| `Email__PublicUrl` | Where `/?invite=<token>` links point. The proxy's domain. |
| `Email__FromName` | Optional display name, `Brewbook` by default. |

Sending is best-effort and never blocks the invitation: a refused or timed-out send is logged with
its status (never the recipient) and the response says `posted: false`, at which point the app hands
the sender the link instead of implying an email went out. Swapping providers is one class —
`IInviteMailer` has a single method and the message itself lives in `Features/Friends/InviteMail.cs`.
