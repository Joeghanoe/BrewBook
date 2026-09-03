# Brewbook

Brewbook is a personal coffee brew log. One person, one bag of beans at a time, one "brew ticket"
per bag: grind, dose, yield, water temperature, blooms, target time. Between brews the ticket is
adjusted, the brew is timed, the result is rated, and flavours are tagged on a wheel. Bags are
added by scanning the label. It answers one question:

> What did I change since the last brew, and was it better?

Friends swap the numbers behind a rating; it is still not a recipe community, a roaster
catalogue, a shop, or an analytics product.

## What must stay true

### Delta first

Every surface expresses change relative to the previous brew of the same bag: the ticket shows
`was X`, the adjust sheet shows `−0.5 FINER`, the dial-in log reads `93°C (was 94)`. A value on
its own is less useful than the value next to what it replaced. New UI must show the delta, not
just the state.

### Commit on stop

Stopping the timer writes the brew immediately. There is no confirm dialog; undo lives in the
toast and only the most recent brew can be undone. Rating and flavour tags arrive afterwards and
are always skippable. Do not add a "save" step in front of a brew.

### Exact quantities, per-user sequence

Grind, dose, yield and temperature are decimals with fixed precision in Postgres (`numeric`), not
floats. The ticket number is a sequence per user, never global. The database enforces both
(`(user_id, number)` is unique).

### Identity comes only from the proxy

The API trusts `X-Forwarded-Email` from oauth2-proxy and nothing else. It rejects a request
without the header; it never treats one as anonymous. The API therefore has no public domain and
must not get one. The first request from an email provisions that user. Every query is scoped to
the current user; a row that belongs to someone else is a 404, not a 403.

### One bar, one way to each place

Navigation is the bottom bar and nothing else: home, library, map, profile. It carries
destinations, not actions — scan, bean detail, the wheel and the passport are reached from the
place they belong to. Do not add a second route to a screen that the bar already reaches.

### The phone draws its own chrome

No status bar, no home indicator, no clock or battery of the app's own. Screens take their insets
from `env(safe-area-inset-*)` in `.screen`.

### No brewing without a bag

The premise is coffees. With no open bag, home is the first task — add a bag — not a ticket with
a disabled button.

### A capability that is off has no routes

Friends, invitations and shared recipes sit behind `Features__Friends`, off by default. Off is not
a polite refusal: the routes are never mapped, the map ignores `?scope=`, and no mailer is
constructed. `/api/v1/me` reports every capability through `Capabilities`, and the client drops the
surface rather than disabling it. Turning one on is an edit to `.railway/railway.ts`, so it is
reviewed like code. Nothing is deleted while a capability is off.

### Rating is what publishing is

A rated brew is visible to friends unless it is marked private; an unrated one is never visible,
whatever the flags say. There is no separate share step and no decision at the moment of rating.
`FriendGraph.SharedBrewsOf` is the only way a friend's brews are read — do not widen it.

### Friendship is mutual and starts with a link

One row per ordered pair in `friendships`, written only when an invitation is accepted. No
directory, no search, nobody discoverable: an invite token is the whole key. Before acceptance the
invitee can read the invitation and nothing else.

### Ratings stay attributed

A roaster carries one `RoasterVoice` per person, each with their own rating. Never average people
into a score, and never render a friend's pin so it looks like the user's own.

### Honest states

Label reading and voice transcription go through Gemini and are best-effort. When the key is not
configured, or a label cannot be read, the UI says so and hands the field to the user; voice falls
back to the browser's recogniser. Never render an unread field as a value, never apply a voice
command that was not understood. The parse from transcript to ticket delta is deterministic and
local (`VoiceCommandParser`), whatever produced the transcript.

## Vocabulary

- A roaster is a *place near the drinker*; a bean's `origin` is where the coffee grew. The two are
  unrelated, and origin must never be used to locate a roaster.
- A `bean` (or `bag`) is one bag of coffee: name, roaster, origin, process, roast date, declared
  notes. Archiving hides it from the switcher; it keeps its brews.
- The `ticket` is the set of five params the next brew will use, plus a `base` (the previous
  brew's params, or the method defaults for a bag's first brew).
- A `brew` is one timed extraction of one bag: params, duration, pour markers, rating, defects,
  flavour tags. `number` is its ticket N°.
- A `flavour tag` is a leaf of the wheel with a polarity: `+1` tagged, `−1` disliked.
- `Declared notes` are what the roaster printed on the bag. They map onto wheel categories where
  the lexicon knows them and stay quoted text where it does not.
- A `label scan` is one attempt to read a bag photo. Its fields carry a provenance:
  `extracted`, `partial`, `missing`.
- A `friendship` is mutual and permanent for now; a `friend invite` is a token, optionally
  addressed to an email, that expires and is used once.
- A `recipe` is not an object. It is a friend's rated brew: the five ticket values, the time, the
  stars and the tags. Taking one copies its numbers onto your ticket, never its bag.
- A `wish` is a roaster pinned as somewhere to go. It clears itself when a bag from that roaster
  reaches the library.
- The bag's `weight` comes off the label and is as skippable as any other field. With it, the
  library counts down `brewsLeft` and asks once whether a bag is finished; without it, neither.
- An `achievement` is a stamp in the `passport`, earned by tasting (tagging, either polarity)
  flavours, brewing or adding bags. The catalogue is code (`Features/Achievements`); rules are
  pure over (brews, tags, beans). A stamp is never taken back.

## Where the system lives

```text
services/web        React + Vite + TypeScript SPA (vanilla CSS, design tokens in styles.css)
services/mobile     Expo (React Native) app for iOS and Android; the same screens, store and copy
                    as web, tokens in src/theme/tokens.ts, native camera/mic/maps
services/api        .NET 10 ASP.NET Core minimal API + EF Core + Npgsql
  src/Brewbook.Api
    Program.cs        composition root and pipeline
    Auth/             proxy-identity middleware, CurrentUser
    Contracts/        wire DTOs for /api/v1
    Domain/           entities and BrewParams
    Data/             DbContext and append-only migrations
    Features/         one folder per capability: Beans, Brews, Voice, Labels, Users, Achievements,
                      Roasters, Friends, Profile
    Integrations/     Gemini client (the only outbound dependency)
  tests/Brewbook.Api.Tests   xunit; the real host on in-memory SQLite
infra               per-service Dockerfiles, nginx template, local edge config
.railway            Railway infrastructure as code (railway.ts) and its runbook
.github/workflows   CI: api build+test, web typecheck+test+build, image builds
docker-compose.yml  local stack with a fake identity edge
```

Three deployable services and a database. `web` is static files; `api` owns the schema; `proxy`
is the stock `quay.io/oauth2-proxy/oauth2-proxy` image configured entirely by environment. The
web client talks to `/api/v1/*` on its own origin; oauth2-proxy routes it to the API.

Wire shapes live in `services/api/src/Brewbook.Api/Contracts/Dtos.cs` and are mirrored by hand in
`services/web/src/api/types.ts` and `services/mobile/src/api/types.ts`. Change all three in the same
commit; `services/mobile/src/lib/*` is likewise a copy of the web's pure rules. Routes are versioned by prefix
(`/api/v1`); add fields, never repurpose them.

Migrations are append-only under `services/api/src/Brewbook.Api/Data/Migrations`. Add one with
`dotnet ef migrations add <Name>`; never edit an applied migration. The API applies migrations on
startup and is the only thing that touches the schema.

## Code taste

- .NET conventions: constructor injection, the options pattern for config, ProblemDetails for
  errors, minimal APIs grouped per feature, one composition root in `Program.cs`. No repository
  wrappers or mapping layers over EF Core; the endpoint is the application service.
- Keep the container out of domain code. `VoiceCommandParser`, `FlavourLexicon` and
  `GeminiLabelExtractor.Map` are pure and tested without a host or a network.
- Outbound integrations are few and each hides behind one interface: `ILabelExtractor` /
  `ISpeechTranscriber` (Gemini), `IRoasterLocator` (Google Places), `IInviteMailer` (Cloudflare
  Email Sending). Each has an `Unconfigured` implementation, and `/api/v1/me` reports which are
  configured so the client can pick its path without probing. A send that fails is logged and
  reported, never retried in the request and never allowed to fail the write it followed.
- Validate at the edge (endpoint), keep internal types precise after that.
- The web client keeps one store (`state/store.tsx`). Screens are components; there is no router
  because the app is a stack of screens and sheets, not URLs. The one URL that matters is
  `/?invite=<token>`, which the store reads once and then strips.
- Match the design tokens exactly: colours, type, spacing and copy in `services/web/src/styles.css`
  (and their mirror in `services/mobile/src/theme/tokens.ts`) come from the handoff. Sharp corners everywhere except circles and the phone shell. Hit targets
  are at least 44px.
- Redact nothing you do not need to log; log nothing that identifies a user beyond what an error
  needs.
- Comments explain constraints code cannot express. No history narration.
- Apply the `unslop` skill to prose, UI copy and commit messages.

Avoid infrastructure the current change does not need. This repo does not need a message queue,
a cache, a second datastore, an auth library in the API, or a component framework.

## Follow a change across boundaries

- A new brew or bean field touches the entity, a migration, the DTO, `types.ts`, the screen that
  shows it, and a test.
- A new environment variable touches `.railway/railway.ts` (`preserve()` for secrets), `.env.example`,
  `docker-compose.yml` if local, and the README. A variable that turns a feature on also touches
  `FeatureFlags`, so the UI can say which path the user is getting.
- A file a Dockerfile copies must be in the matching `WATCH` list in `.railway/railway.ts`.
- A new UI state needs loading, empty, unavailable and error behaviour at 390px width.
- A voice phrase the parser should understand gets a row in `VoiceCommandParserTests`.

## Verifying

Run what CI runs, in CI's order and configuration. A Debug build is not the same check, and
`dotnet build` after `dotnet test` is a no-op that reports success without recompiling anything —
between them that combination hides diagnostics that fail the pipeline.

```bash
# API: Release, warnings as errors, then the tests against that same build
# (in-memory SQLite, no Postgres needed)
dotnet restore services/api/Brewbook.slnx
dotnet build services/api/Brewbook.slnx --no-restore -c Release -warnaserror
dotnet test services/api/Brewbook.slnx --no-build -c Release

# Web
cd services/web && npm run typecheck && npm test && npx vite build

# Mobile (JS side; the native build is `npm run ios` / `npm run android`)
cd services/mobile && npm run typecheck && npm test && npx expo export --platform ios

# Whole stack locally (fake identity, no Google): http://localhost:3000
docker compose up --build
```

After adding a file to a test project, build before trusting a green run: an incremental build can
skip the project that holds the new code.

Backend behaviour changes ship with a focused test. Do not point tests at a hosted database.
Report which checks ran and whether they passed; leave unclaimed what could not run.

## Safety and external actions

- Do not run `railway config apply`, change Railway variables, or redeploy unless the maintainer
  asks. Editing `.railway/railway.ts` is inert; applying it is not.
- Never commit secrets. `preserve()` in `railway.ts` declares a variable's existence only.
- Never give `api` or `web` a public Railway domain.
- Do not commit, push, open a PR or merge unless the maintainer asks for that git action.

## Railway hygiene

Lessons from the first deployment day. Each of these cost real debugging time.

- **`railway.ts` is the whole truth for variables.** Every variable on a service is either declared
  there (literal or `preserve()`) or it is drift. Never leave a variable behind that equals a code
  default (`ProxyIdentity__*`, `Gemini__Model`) or that was only set to poke a rebuild
  (`NGINX_ENTRYPOINT_QUIET_LOGS`, `DOTNET_CLI_TELEMETRY_OPTOUT`). Overrides hide the real defaults
  and make the next `railway config plan` a guessing game.
- **Trigger a rebuild by pushing a commit that matches the service's watch patterns**, or with
  `railway redeploy`. Do not set junk variables to force one. If pushes stop triggering builds,
  fix the GitHub app connection in Railway rather than working around it.
- **Services build from `main`.** Pointing `web` or `api` at a feature branch is a short-lived
  debugging move; flip it back the moment the PR merges and say so.
- **Only `proxy` has a domain.** A domain on `web` or `api` bypasses sign-in. Delete it on sight.
- **oauth2-proxy → API header contract** is `X-Forwarded-Email` (with `-User`,
  `-Preferred-Username`) from `pass-user-headers`. `prefer-email-to-user` and `set-xauthrequest`
  both break it silently and stay off; the reasons are in `.railway/README.md`.
- **The API logs the header names it received when it rejects a request.** Read that before
  changing any auth config.

## When to ask

Ask when the answer changes product behaviour, risks data loss, needs a secret, or widens scope.
Otherwise take the simplest reasonable reading, implement it, and state the assumption.
