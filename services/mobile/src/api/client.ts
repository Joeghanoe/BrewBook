import { DEV_EMAIL, ORIGIN } from "../config";
import type { Bean, Brew, BrewParams, Config, CreateBean, CreatedInvite, FlavourTag, UpdateBean, Friend, FriendInvite, Friends, LabelScan, Me, Passport, Profile, Roaster, RoasterScope, SharedBrew, VoiceParse } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** A file on this device, as fetch's FormData takes it on React Native. */
export interface LocalFile { uri: string; name: string; type: string }

const BASE = ORIGIN + "/api/v1";

// The store subscribes here: a request the proxy would not let through means the session is gone.
let onSignedOut: () => void = () => {};
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

const identity = (): Record<string, string> =>
  DEV_EMAIL ? { "X-Forwarded-Email": DEV_EMAIL, "X-Forwarded-User": DEV_EMAIL.split("@")[0] } : {};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: "include",
    ...init,
    headers: { ...identity(), ...(init?.headers as Record<string, string> | undefined) },
  });
  // oauth2-proxy answers an unauthenticated request with a redirect to Google, which fetch follows
  // off our origin; a straight 401/403 means the same thing.
  const strayed = !!res.url && !res.url.startsWith(BASE);
  if (res.status === 401 || res.status === 403 || strayed) {
    onSignedOut();
    throw new ApiError(res.status, "Signed out");
  }
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? body.title ?? detail;
      if (body.errors) detail += ": " + Object.values(body.errors).flat().join(" ");
    } catch { /* not a problem+json body */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const file = (form: FormData, field: string, f: LocalFile) => form.append(field, f as unknown as Blob);

export const api = {
  me: () => request<Me>("/me"),
  markOnboarded: () => request<Me>("/me/onboarded", { method: "POST" }),
  setSharing: (shareRatedByDefault: boolean) => request<Me>("/me", json("PATCH", { shareRatedByDefault })),
  profile: () => request<Profile>("/profile"),
  beans: () => request<Bean[]>("/beans"),
  createBean: (b: CreateBean) => request<Bean>("/beans", json("POST", b)),
  updateBean: (id: string, patch: UpdateBean) => request<Bean>(`/beans/${id}`, json("PATCH", patch)),
  archiveBean: (id: string, archived: boolean) => request<Bean>(`/beans/${id}`, json("PATCH", { archived, archivePromptAnswered: true })),
  /** Answering the archive prompt without archiving: asked once, then never again for that bag. */
  keepBean: (id: string) => request<Bean>(`/beans/${id}`, json("PATCH", { archivePromptAnswered: true })),
  scanLabel: (image: LocalFile) => {
    const form = new FormData();
    file(form, "image", image);
    return request<LabelScan>("/beans/scan", { method: "POST", body: form });
  },
  brews: () => request<Brew[]>("/brews?limit=500"),
  /** `durationMs` null logs the brew untimed; the time can be entered afterwards. */
  createBrew: (beanId: string, params: BrewParams, durationMs: number | null, pourMarkersMs: number[]) =>
    request<Brew>("/brews", json("POST", { beanId, params, durationMs, pourMarkersMs })),
  updateBrew: (id: string, patch: { durationMs?: number }) => request<Brew>(`/brews/${id}`, json("PATCH", patch)),
  deleteBrew: (id: string) => request<void>(`/brews/${id}`, { method: "DELETE" }),
  rateBrew: (id: string, rating: number | null, defects: string[] | null) =>
    request<Brew>(`/brews/${id}/rating`, json("PATCH", { rating, defects })),
  tagBrew: (id: string, tags: FlavourTag[]) => request<Brew>(`/brews/${id}/tags`, json("PUT", { tags })),
  setBrewPrivacy: (id: string, isPrivate: boolean) => request<Brew>(`/brews/${id}/privacy`, json("PATCH", { isPrivate })),
  passport: () => request<Passport>("/achievements"),
  parseVoice: (transcript: string, current: BrewParams) => request<VoiceParse>("/voice/parse", json("POST", { transcript, current })),
  transcribeVoice: (audio: LocalFile, current: BrewParams) => {
    const form = new FormData();
    file(form, "audio", audio);
    form.append("current", JSON.stringify(current));
    return request<VoiceParse>("/voice/transcribe", { method: "POST", body: form });
  },
  config: () => request<Config>("/config"),
  roasters: (flavours: string[], scope: RoasterScope) => {
    const q = new URLSearchParams({ scope });
    if (flavours.length) q.set("flavours", flavours.join(","));
    return request<Roaster[]>("/roasters?" + q.toString());
  },
  recipes: (roasterId: string, userId: string) => request<SharedBrew[]>(`/roasters/${roasterId}/recipes?userId=${userId}`),
  wishRoaster: (id: string, wanted: boolean) => request<void>(`/roasters/${id}/wish`, { method: wanted ? "PUT" : "DELETE" }),
  friends: () => request<Friends>("/friends"),
  createInvite: (email: string | null) => request<CreatedInvite>("/friends/invites", json("POST", { email })),
  readInvite: (token: string) => request<FriendInvite>(`/friends/invites/${encodeURIComponent(token)}`),
  revokeInvite: (token: string) => request<void>(`/friends/invites/${encodeURIComponent(token)}`, { method: "DELETE" }),
  acceptInvite: (token: string) => request<Friend>(`/friends/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }),
  relocateRoaster: (id: string, query: string | null) => request<Roaster>(`/roasters/${id}/relocate`, json("POST", { query })),
  signInUrl: ORIGIN + "/oauth2/start?rd=%2F",
  signOutUrl: ORIGIN + "/oauth2/sign_out",
};
