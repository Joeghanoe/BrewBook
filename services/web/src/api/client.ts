import type { Bean, Brew, BrewParams, Config, CreateBean, CreatedInvite, FlavourTag, Friend, FriendInvite, Friends, LabelScan, Me, Passport, Profile, Roaster, RoasterScope, SharedBrew, UpdateBean, UpdateBrew, VoiceParse } from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const BASE = "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, { credentials: "same-origin", ...init });
  if (res.status === 401 || res.status === 403) {
    // oauth2-proxy's cookie expired: a full navigation hits the login redirect.
    window.location.assign("/oauth2/start?rd=" + encodeURIComponent(window.location.pathname));
    throw new ApiError(res.status, "Signed out");
  }
  if (!res.ok) {
    let detail = res.statusText;
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
  scanLabel: (image: Blob) => {
    const form = new FormData();
    form.append("image", image, "label.jpg");
    return request<LabelScan>("/beans/scan", { method: "POST", body: form });
  },
  brews: () => request<Brew[]>("/brews?limit=500"),
  /** `durationMs` null logs the brew untimed; the time can be entered afterwards. */
  createBrew: (beanId: string, params: BrewParams, durationMs: number | null, pourMarkersMs: number[]) =>
    request<Brew>("/brews", json("POST", { beanId, params, durationMs, pourMarkersMs })),
  updateBrew: (id: string, patch: UpdateBrew) => request<Brew>(`/brews/${id}`, json("PATCH", patch)),
  deleteBrew: (id: string) => request<void>(`/brews/${id}`, { method: "DELETE" }),
  rateBrew: (id: string, rating: number | null, defects: string[] | null) =>
    request<Brew>(`/brews/${id}/rating`, json("PATCH", { rating, defects })),
  tagBrew: (id: string, tags: FlavourTag[]) => request<Brew>(`/brews/${id}/tags`, json("PUT", { tags })),
  setBrewPrivacy: (id: string, isPrivate: boolean) => request<Brew>(`/brews/${id}/privacy`, json("PATCH", { isPrivate })),
  passport: () => request<Passport>("/achievements"),
  parseVoice: (transcript: string, current: BrewParams) => request<VoiceParse>("/voice/parse", json("POST", { transcript, current })),
  transcribeVoice: (audio: Blob, current: BrewParams) => {
    const form = new FormData();
    form.append("audio", audio, "clip.webm");
    form.append("current", JSON.stringify(current));
    return request<VoiceParse>("/voice/transcribe", { method: "POST", body: form });
  },
  config: () => request<Config>("/config"),
  roasters: (flavours: string[], scope: RoasterScope) => {
    const q = new URLSearchParams({ scope });
    if (flavours.length) q.set("flavours", flavours.join(","));
    return request<Roaster[]>("/roasters?" + q);
  },
  recipes: (roasterId: string, userId: string) => request<SharedBrew[]>(`/roasters/${roasterId}/recipes?userId=${userId}`),
  wishRoaster: (id: string, wanted: boolean) => request<void>(`/roasters/${id}/wish`, { method: wanted ? "PUT" : "DELETE" }),
  friends: () => request<Friends>("/friends"),
  createInvite: (email: string | null) => request<CreatedInvite>("/friends/invites", json("POST", { email })),
  readInvite: (token: string) => request<FriendInvite>(`/friends/invites/${encodeURIComponent(token)}`),
  revokeInvite: (token: string) => request<void>(`/friends/invites/${encodeURIComponent(token)}`, { method: "DELETE" }),
  acceptInvite: (token: string) => request<Friend>(`/friends/invites/${encodeURIComponent(token)}/accept`, { method: "POST" }),
  relocateRoaster: (id: string, query: string | null) => request<Roaster>(`/roasters/${id}/relocate`, json("POST", { query })),
  signOutUrl: "/oauth2/sign_out",
};
