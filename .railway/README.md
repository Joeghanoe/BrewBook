# Railway infrastructure as code

`railway.ts` is the source of truth for the shape of the Railway project: which services exist,
how each is built, what it consumes, and which variables must not be deleted.

**Nothing here is read at deploy time.** Railway does not fetch this file when it builds. A human
applies it with the CLI:

```bash
railway login
railway link            # pick the BrewBook project + environment
railway config plan     # read-only: what WOULD change
railway config apply    # applies, after showing the plan again
```

Editing the file is inert; applying it is the action with a blast radius. The file mirrors the
whole project, so a resource that exists in Railway but not here reads as "delete it".

The deprecated Config as Code (`railway.json` / `railway.toml`) is not used anywhere in this repo.

## Topology

```
browser ──HTTPS──► proxy (oauth2-proxy, Google)  ── public domain
                     ├─ /api/*  ──► api  (.NET 10)      ── private network only
                     └─ /*      ──► web  (nginx + SPA)   ── private network only
                                     api ──► postgres
```

Only `proxy` has a public domain. `api` trusts `X-Forwarded-Email` from the proxy and rejects
requests without it, so it must never get a public domain: give it one and anyone can forge the
header. `web` has no reason to be public either.

## First-time setup

1. Push `main`, then `railway config apply` from a linked checkout to create the four services.
2. In the dashboard give `proxy` a domain (Settings → Networking → Generate Domain, or a custom one).
3. In Google Cloud Console create an OAuth 2.0 client (Web application) with the redirect URI
   `https://<proxy domain>/oauth2/callback`.
4. Set these variables on `proxy` (they are declared with `preserve()` so applies never remove them):

   | Variable | Value |
   |---|---|
   | `OAUTH2_PROXY_CLIENT_ID` | Google client ID |
   | `OAUTH2_PROXY_CLIENT_SECRET` | Google client secret |
   | `OAUTH2_PROXY_COOKIE_SECRET` | 32 random bytes, base64: `python3 -c 'import os,base64;print(base64.urlsafe_b64encode(os.urandom(32)).decode())'` |
   | `OAUTH2_PROXY_REDIRECT_URL` | `https://<proxy domain>/oauth2/callback` |
   | `OAUTH2_PROXY_EMAIL_DOMAINS` | `*` (any Google account, each isolated) or a Workspace domain |

5. Optional, on `api`: `GEMINI_API_KEY` turns on label reading and voice transcription;
   `GOOGLE_MAPS_SERVER_KEY` and `GOOGLE_MAPS_BROWSER_KEY` turn on the roaster map (see the main
   README for the Cloud Console steps and key restrictions).
6. Redeploy `proxy` after setting variables.

`DATABASE_URL` on `api` is a reference to the Postgres service and is managed by this file.
The API runs its EF Core migrations on start (`Database__MigrateOnStartup=true`); nothing else
touches the schema.

## Header contract with the API

oauth2-proxy forwards `X-Forwarded-Email`, `X-Forwarded-User` and `X-Forwarded-Preferred-Username`
to upstreams (`pass-user-headers`). The API keys identity on `X-Forwarded-Email`. Two flags break
that silently: `prefer-email-to-user` (moves the email into `-User` and drops `-Email`) and
`set-xauthrequest` (only adds `X-Auth-Request-*` to the browser response). Keep both off.

## Variables are the file, nothing more

The live variable set on each service must equal what `railway.ts` declares. `railway config plan`
will surface anything extra; treat that as a bug, not a warning. In particular never keep a
variable that merely repeats a code default, and never set one just to trigger a build (push a
matching commit or use `railway redeploy` instead).

## Changing things

- New environment variable → add it here (`preserve()` for secrets, a literal for config), set it
  in the dashboard, and mention it in `README.md`.
- New file a Dockerfile copies → extend that service's `WATCH` list or Railway will not rebuild on it.
- Bumping oauth2-proxy → change the image tag here; `railway config apply` rolls it.
