// Where the log lives. In production this is the proxy's public origin, the one place people sign
// in; the cookie oauth2-proxy sets in the sign-in WebView is shared with fetch, so the API is
// reached the same way the SPA reaches it. For local work against `dotnet run` the dev email is
// stamped on every request instead, exactly as vite's dev proxy does.
export const ORIGIN = (process.env.EXPO_PUBLIC_API_ORIGIN ?? "http://localhost:8080").replace(/\/$/, "");
export const DEV_EMAIL = process.env.EXPO_PUBLIC_DEV_EMAIL ?? null;
