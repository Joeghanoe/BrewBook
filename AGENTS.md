# Brewbook

Brewbook is a personal coffee brew log. One person, one bag of beans at a time, one "brew ticket"
per bag: grind, dose, yield, water temperature, blooms, target time. Between brews the ticket is
adjusted, the brew is timed, the result is rated, and flavours are tagged on a wheel. Bags are
added by scanning the label. It answers one question:

> What did I change since the last brew, and was it better?

It is not a recipe community, a roaster catalogue, a shop, or an analytics product.

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

The API trusts `X-Auth-Request-Email` from oauth2-proxy and nothing else. It rejects a request
without the header; it never treats one as anonymous. The API therefore has no public domain and
must not get one. The first request from an email provisions that user. Every query is scoped to
the current user; a row that belongs to someone else is a 404, not a 403.

### Honest states

Label reading and voice transcription go through Gemini and are best-effort. When the key is not
configured, or a label cannot be read, the UI says so and hands the field to the user; voice falls
back to the browser's recogniser. Never render an unread field as a value, never apply a voice
command that was not understood. The parse from transcript to ticket delta is deterministic and
local (`VoiceCommandParser`), whatever produced the transcript.

## Vocabulary

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

## Where the system lives

```text
services/web        React + Vite + TypeScript SPA (vanilla CSS, design tokens in styles.css)
services/api        .NET 10 ASP.NET Core minimal API + EF Core + Npgsql
  src/Brewbook.Api
    Program.cs        composition root and pipeline
    Auth/             proxy-identity middleware, CurrentUser
    Contracts/        wire DTOs for /api/v1
    Domain/           entities and BrewParams
    Data/             DbContext and append-only migrations
    Features/         one folder per capability: Beans, Brews, Voice, Labels, Users
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
`services/web/src/api/types.ts`. Change both in the same commit. Routes are versioned by prefix
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
- One outbound integration (`Integrations/Gemini`), one key, one HttpClient. Providers hide behind
  `ILabelExtractor` / `ISpeechTranscriber`; `/api/v1/me` reports which are configured so the client
  can pick its path without probing.
- Validate at the edge (endpoint), keep internal types precise after that.
- The web client keeps one store (`state/store.tsx`). Screens are components; there is no router
  because the app is a stack of screens and sheets, not URLs.
- Match the design tokens exactly: colours, type, spacing and copy in `services/web/src/styles.css`
  come from the handoff. Sharp corners everywhere except circles and the phone shell. Hit targets
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
  `docker-compose.yml` if local, and the README.
- A file a Dockerfile copies must be in the matching `WATCH` list in `.railway/railway.ts`.
- A new UI state needs loading, empty, unavailable and error behaviour at 390px width.
- A voice phrase the parser should understand gets a row in `VoiceCommandParserTests`.

## Verifying

```bash
# API: build with warnings as errors, then the tests (in-memory SQLite, no Postgres needed)
dotnet build services/api/Brewbook.slnx -warnaserror
dotnet test services/api/Brewbook.slnx

# Web
cd services/web && npm run typecheck && npm test && npm run build

# Whole stack locally (fake identity, no Google): http://localhost:3000
docker compose up --build
```

Backend behaviour changes ship with a focused test. Do not point tests at a hosted database.
Report which checks ran and whether they passed; leave unclaimed what could not run.

## Safety and external actions

- Do not run `railway config apply`, change Railway variables, or redeploy unless the maintainer
  asks. Editing `.railway/railway.ts` is inert; applying it is not.
- Never commit secrets. `preserve()` in `railway.ts` declares a variable's existence only.
- Never give `api` or `web` a public Railway domain.
- Do not commit, push, open a PR or merge unless the maintainer asks for that git action.

## When to ask

Ask when the answer changes product behaviour, risks data loss, needs a secret, or widens scope.
Otherwise take the simplest reasonable reading, implement it, and state the assumption.
