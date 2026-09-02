// Brewbook's Railway project, as code.
//
// Four services: `proxy` (oauth2-proxy, the only one with a public domain), `web` (nginx serving
// the SPA), `api` (.NET) and `postgres`. Applied by a human with `railway config plan` / `apply`;
// nothing here is read at deploy time. `.railway/README.md` is the runbook.
//
// This mirrors the WHOLE project on purpose: `railway config plan` reconciles the file against
// the live environment, so a resource missing here reads as "delete it".

import { defineRailway, github, image, postgres, preserve, project, service } from "railway/iac";

const SOURCE = { repo: "Joeghanoe/BrewBook", branch: "main" } as const;

// Secrets are set in the Railway dashboard and never appear in git. `preserve()` declares that a
// variable exists and must not be deleted, without naming its value.
const preserveAll = (...names: string[]): Record<string, ReturnType<typeof preserve>> =>
  Object.fromEntries(names.map((name) => [name, preserve()]));

// Ceilings, not reservations: Railway bills per minute of actual use. A cap bounds the blast
// radius of a runaway process; it saves no baseline spend.
const GB = 1024 ** 3;
const limits = (cpu: number, memoryGB: number) => ({
  limitOverride: { containers: { cpu, memoryBytes: memoryGB * GB } },
});

const REGION = { "europe-west4-drams3a": 1 } as const;

// Inputs each image is built from. Railway rebuilds a GitHub-sourced service on every push
// unless told which paths matter, so keep these lists honest when a Dockerfile grows a COPY.
const WATCH = {
  api: ["services/api/src/**", "infra/api.Dockerfile", ".dockerignore"],
  web: ["services/web/**", "!services/web/node_modules/**", "infra/web.Dockerfile", "infra/web.nginx.conf.template", ".dockerignore"],
};

export default defineRailway(() => {
  const db = postgres("postgres");

  // Serves the built SPA. No public domain: it is only reachable through the proxy.
  const web = service("web", {
    source: github(SOURCE.repo, { branch: SOURCE.branch, checkSuites: false }),
    build: { builder: "DOCKERFILE", dockerfilePath: "infra/web.Dockerfile", watchPatterns: WATCH.web },
    healthcheck: "/",
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5, ...limits(1, 0.5) },
    replicas: REGION,
    env: { PORT: "8080" },
  });

  // The .NET API. No public domain either: it trusts the identity headers oauth2-proxy sets, so it
  // must never be reachable from anywhere else (see services/api/.../Auth/ProxyIdentityOptions.cs).
  const api = service("api", {
    source: github(SOURCE.repo, { branch: SOURCE.branch, checkSuites: false }),
    build: { builder: "DOCKERFILE", dockerfilePath: "infra/api.Dockerfile", watchPatterns: WATCH.api },
    healthcheck: "/health",
    healthcheckTimeout: 120,
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5, ...limits(1, 1) },
    replicas: REGION,
    env: {
      PORT: "8080",
      DATABASE_URL: db.env.DATABASE_URL,
      // The API runs EF Core migrations on startup. It is the only writer of the schema.
      Database__MigrateOnStartup: "true",
      // Optional. One Gemini key turns on both label reading and server-side voice transcription;
      // when unset the app says so and falls back (manual bag entry, browser speech recogniser).
      // Set up per README.md → Google Cloud Console.
      // Where the drinker is, as a two-letter CLDR region. Biases the roaster search towards home:
      // a specialty roaster is near the person drinking, not near where the coffee grew. Unset
      // means Places ranks globally, which is rarely what a personal log wants.
      GoogleMaps__RegionCode: "NL",
      // Optional. Two Maps Platform keys for the roaster map: the server key (Places API only)
      // geocodes roaster names from the API; the browser key (Maps JavaScript API, restricted to
      // the proxy domain as referrer) is handed to the SPA. Without them roasters stay unlocated
      // and the map screen shows a list.
      // Friends, invitations, shared recipes and the map's friends scope are off in code and stay
      // off here. Turn them on by adding Features__Friends: "true" below — deliberately a code
      // change, so enabling a capability is reviewable rather than a dashboard click.
      // Optional. Cloudflare Email Sending posts friend invitations, and needs Features__Friends
      // as well. Without it an invitation is still made and still works — it just travels as a
      // link the sender passes on themselves.
      // Email__From must sit on a domain onboarded for Email Sending; Email__PublicUrl is the
      // proxy's public domain, which is where an invitation link has to land.
      ...preserveAll(
        "GEMINI_API_KEY", "GOOGLE_MAPS_SERVER_KEY", "GOOGLE_MAPS_BROWSER_KEY",
        "CLOUDFLARE_EMAIL_TOKEN", "Email__AccountId", "Email__From", "Email__PublicUrl",
      ),
    },
  });

  // oauth2-proxy in front of everything. Google OIDC; forwards `X-Forwarded-Email` upstream.
  // `/api/*` goes to the API, everything else to the SPA. Give THIS service the public domain and
  // put that domain in OAUTH2_PROXY_REDIRECT_URL (https://<domain>/oauth2/callback).
  const proxy = service("proxy", {
    source: image("quay.io/oauth2-proxy/oauth2-proxy:v7.14.2"),
    healthcheck: "/ping",
    deploy: { restartPolicyType: "ON_FAILURE", restartPolicyMaxRetries: 5, ...limits(1, 0.5) },
    replicas: REGION,
    env: {
      OAUTH2_PROXY_PROVIDER: "google",
      // Dual-stack bind: Railway's private network and public edge both reach it.
      OAUTH2_PROXY_HTTP_ADDRESS: "[::]:8080",
      OAUTH2_PROXY_REVERSE_PROXY: "true",
      OAUTH2_PROXY_UPSTREAMS: `http://\${{web.RAILWAY_PRIVATE_DOMAIN}}:8080/,http://\${{api.RAILWAY_PRIVATE_DOMAIN}}:8080/api/`,
      // pass-user-headers is what reaches the API (X-Forwarded-Email etc.). set-xauthrequest
      // would only add response headers for the browser and is deliberately off.
      OAUTH2_PROXY_PASS_USER_HEADERS: "true",
      OAUTH2_PROXY_PASS_ACCESS_TOKEN: "false",
      // Never set prefer-email-to-user here: it moves the email into X-Forwarded-User and drops
      // X-Forwarded-Email, which is the header the API keys identity on (observed 2026-09-01).
      OAUTH2_PROXY_SKIP_PROVIDER_BUTTON: "true",
      OAUTH2_PROXY_COOKIE_SECURE: "true",
      OAUTH2_PROXY_COOKIE_SAMESITE: "lax",
      OAUTH2_PROXY_COOKIE_EXPIRE: "168h",
      OAUTH2_PROXY_COOKIE_REFRESH: "1h",
      // Who may sign in. `*` means any Google account gets its own private log; set a Workspace
      // domain to restrict it. Maintainer-managed, so preserved rather than declared here.
      ...preserveAll(
        "OAUTH2_PROXY_CLIENT_ID",
        "OAUTH2_PROXY_CLIENT_SECRET",
        "OAUTH2_PROXY_COOKIE_SECRET",
        "OAUTH2_PROXY_REDIRECT_URL",
        "OAUTH2_PROXY_EMAIL_DOMAINS",
      ),
    },
  });

  return project("BrewBook", { resources: [db, web, api, proxy] });
});
