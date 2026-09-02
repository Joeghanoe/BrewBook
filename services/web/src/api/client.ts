import type { Bean, Brew, BrewParams, Config, CreateBean, FlavourTag, LabelScan, Me, Profile, Roaster, VoiceParse } from "./types";

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
  profile: () => request<Profile>("/profile"),
  beans: () => request<Bean[]>("/beans"),
  createBean: (b: CreateBean) => request<Bean>("/beans", json("POST", b)),
  archiveBean: (id: string, archived: boolean) => request<Bean>(`/beans/${id}`, json("PATCH", { archived })),
  scanLabel: (image: Blob) => {
    const form = new FormData();
    form.append("image", image, "label.jpg");
    return request<LabelScan>("/beans/scan", { method: "POST", body: form });
  },
  brews: () => request<Brew[]>("/brews?limit=500"),
  createBrew: (beanId: string, params: BrewParams, durationMs: number, pourMarkersMs: number[]) =>
    request<Brew>("/brews", json("POST", { beanId, params, durationMs, pourMarkersMs })),
  deleteBrew: (id: string) => request<void>(`/brews/${id}`, { method: "DELETE" }),
  rateBrew: (id: string, rating: number | null, defects: string[] | null) =>
    request<Brew>(`/brews/${id}/rating`, json("PATCH", { rating, defects })),
  tagBrew: (id: string, tags: FlavourTag[]) => request<Brew>(`/brews/${id}/tags`, json("PUT", { tags })),
  parseVoice: (transcript: string, current: BrewParams) => request<VoiceParse>("/voice/parse", json("POST", { transcript, current })),
  transcribeVoice: (audio: Blob, current: BrewParams) => {
    const form = new FormData();
    form.append("audio", audio, "clip.webm");
    form.append("current", JSON.stringify(current));
    return request<VoiceParse>("/voice/transcribe", { method: "POST", body: form });
  },
  config: () => request<Config>("/config"),
  roasters: (flavours: string[]) => request<Roaster[]>("/roasters" + (flavours.length ? "?flavours=" + encodeURIComponent(flavours.join(",")) : "")),
  relocateRoaster: (id: string, query: string | null) => request<Roaster>(`/roasters/${id}/relocate`, json("POST", { query })),
  signOutUrl: "/oauth2/sign_out",
};
