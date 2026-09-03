# Brewbook mobile

The same app as `services/web`, as a native iOS and Android build: Expo (React Native), TypeScript,
no navigation library. Screens, store, copy and tokens mirror the web client one for one; the
product rules in the repo's `AGENTS.md` apply here unchanged.

## Run it

```bash
cd services/mobile
npm install
cp .env.example .env           # set EXPO_PUBLIC_API_ORIGIN

npm run ios                    # builds the dev client and opens the simulator
npm run android                # same, for an emulator or a plugged-in phone
```

Camera, microphone, speech recognition and maps are native modules, so the app needs a dev client
(`expo run:*` or an EAS build). Expo Go cannot run it.

Expo SDK 55: iOS builds need Xcode 26.0 or newer, Android builds JDK 17 and an Android SDK. SDK 56
and later need Xcode 26.4, which is why this stays on 55 until the build machines have it.

## Where the log lives

| Variable | Effect |
|---|---|
| `EXPO_PUBLIC_API_ORIGIN` | The proxy's public origin. Sign-in opens `/oauth2/start` in a WebView; the cookie oauth2-proxy sets is shared with `fetch`, so `/api/v1/*` is reached exactly as the SPA reaches it. |
| `EXPO_PUBLIC_DEV_EMAIL` | Local only. Points the app at `dotnet run` on `EXPO_PUBLIC_API_ORIGIN` and stamps `X-Forwarded-Email` on every request, as vite's dev proxy does. The simulator reaches the host at `http://localhost:8080`; a physical phone needs the machine's LAN address. |

Identity still comes only from the proxy: the app never holds a token of its own, and a request
the proxy turns away (a 401, or a redirect to Google) drops the app back to the sign-in door.
SIGN OUT hits `/oauth2/sign_out` and clears the cookie jar.

## What is native here

- **Label scan** — `expo-camera`, with the photo library as the fallback when there is no camera or
  permission. Frames are shrunk to 1600px before upload, like the web.
- **Voice while brewing** — `expo-speech-recognition` for live on-device text; when the device has no
  recogniser and the API reports `speechTranscription`, the clip is recorded with `expo-audio` and
  transcribed server-side. The transcript is parsed by the API either way.
- **Roaster map** — `react-native-maps`. Apple Maps on iOS needs no key. Google on Android needs a
  Maps SDK for Android key in `app.json` (`react-native-maps` plugin, `androidGoogleMapsApiKey`); the
  browser key from `/api/v1/config` is not used, because a native SDK key is restricted differently.
  Pins follow the web: copper for yours, green for a friend's, an outlined ◇ for somewhere to go.
- **Invitations** — a `brewbook://?invite=<token>` link opens on the invitation. The links the app
  hands out are the proxy's `/?invite=<token>`, which open in the browser (the web app) until
  universal links are set up for the proxy domain; copying a link uses the system clipboard.

The desktop door has no equivalent: a phone is the phone. The grain overlay is not drawn.

Install [watchman](https://facebook.github.io/watchman/) (`brew install watchman`) for a reliable
dev loop: without it Metro on macOS can miss edits, and the app keeps showing the old code until
`expo start --clear`.

## Verify

```bash
npm run typecheck
npm test                        # the pure lib rules, shared with the web
npx expo export --platform ios  # the JS bundle resolves
npm run ios                     # the native build compiles
```

`src/api/types.ts` and `src/lib/*` are copies of the web client's. A change to a wire shape touches
`Dtos.cs`, `services/web/src/api/types.ts` and this file in the same commit.
