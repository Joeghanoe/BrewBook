import * as Linking from "expo-linking";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, setSignedOutHandler } from "../api/client";
import type { Bean, Brew, BrewMethod, BrewParams, BrewStep, FlavourTag, Friends, Me, RoasterScope, Unlocked, UpdateBrew } from "../api/types";
import { changedKeys, METHOD_DEFAULTS, fmtTime, sameParams } from "../lib/format";

export type Screen = "splash" | "home" | "timer" | "bean" | "library" | "scan" | "scanform" | "profile" | "roasters" | "passport" | "friends" | "beanedit" | "brewedit";
export type Sheet = null | "adjust" | "switcher" | "method";

/** Whose numbers the ticket is carrying, until they have been brewed once and become the user's own. */
export interface TicketSource { name: string; number: number }

/** `label` names the action button; it reads UNDO when absent. */
export interface Toast { msg: string; undo?: () => void; label?: string }

const STAMP_TOAST_DELAY_MS = 4600;
const TOAST_MS = 4200;

interface Store {
  loading: boolean;
  error: string | null;
  /** False once the proxy has turned a request away; the sign-in screen sets it back. */
  signedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  me: Me | null;
  beans: Bean[];
  brews: Brew[];
  screen: Screen;
  setScreen: (s: Screen) => void;
  sheet: Sheet;
  setSheet: (s: Sheet) => void;

  currentBean: Bean | null;
  selectBean: (id: string) => void;
  beansOpen: Bean[];
  beansArchived: Bean[];
  brewsFor: (beanId: string) => Brew[];
  nextNumber: number;

  params: BrewParams;
  base: BrewParams;
  setParam: (key: Exclude<keyof BrewParams, "method">, value: number) => void;
  /** Switches the ticket's method; the base becomes this bag's last brew of that method, else its defaults. */
  setMethod: (m: BrewMethod) => void;
  /** The bag's last brew of a method, or null: what the method sheet says the switch would load. */
  lastOfMethod: (m: BrewMethod) => Brew | null;
  setParams: (p: BrewParams) => void;
  /** `source` names whose numbers these are; the ticket says so until the first time they are brewed (§5). */
  loadParams: (p: BrewParams, source?: TicketSource | null) => void;
  ticketSource: TicketSource | null;

  /** `durationMs` null logs the brew untimed: the recipe is written, the time comes later. */
  commitBrew: (durationMs: number | null, steps: BrewStep[]) => Promise<void>;
  /** The measured time for a brew logged without the timer. */
  setBrewDuration: (brewId: string, durationMs: number) => Promise<void>;
  rateBrew: (brewId: string, rating: number | null, defects: string[] | null) => Promise<void>;
  /** The brew being edited; the edit screen reads it and sends the user back to the bean without one. */
  editTarget: Brew | null;
  openBrewEdit: (brew: Brew) => void;
  /** Resolves true when the log took the change. */
  updateBrew: (brewId: string, patch: UpdateBrew) => Promise<boolean>;
  /** Tears the page out. The number stays unused; the bag's counts and last brew follow. */
  deleteBrew: (brewId: string) => Promise<boolean>;
  ratePrompt: Brew | null;
  dismissRatePrompt: () => void;

  tagTarget: Brew | null;
  wheelOpen: boolean;
  openWheel: (brew?: Brew | null) => void;
  closeWheel: () => Promise<void>;
  tags: FlavourTag[];
  setTags: (t: FlavourTag[]) => void;

  addBean: (bean: Bean) => void;
  /** Folds an edited bag back into the list without a refetch. */
  patchBean: (bean: Bean) => void;
  archiveBean: (id: string, archived: boolean) => Promise<void>;
  /** Answers the archive prompt with "not yet": the bag stays open and is never asked about again. */
  keepBean: (id: string) => Promise<void>;
  setBrewPrivacy: (brewId: string, isPrivate: boolean) => Promise<void>;
  setSharing: (share: boolean) => Promise<void>;

  /** Whether this deployment has friends, invitations and shared recipes at all. */
  hasFriends: boolean;
  /** Whose roasters the map is showing. One control, defaulting to the user's own (§4). */
  scope: RoasterScope;
  setScope: (s: RoasterScope) => void;
  friends: Friends | null;
  friendsError: string | null;
  loadFriends: () => Promise<void>;
  /** An invitation token from the link the user followed, until it is accepted or dismissed. */
  invite: string | null;
  clearInvite: () => void;

  /** The guide covers whatever screen is underneath; it opens itself once per user, after the splash. */
  guideOpen: boolean;
  openGuide: () => void;
  closeGuide: () => void;
  /** Roaster the map should open on (from a bean's plaque); the Roasters screen clears it. */
  roasterFocus: string | null;
  setRoasterFocus: (id: string | null) => void;

  toast: Toast | null;
  showToast: (msg: string, undo?: () => void, label?: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);

/** The token off a `brewbook://?invite=…` or `https://<proxy>/?invite=…` link. */
const inviteFrom = (url: string | null): string | null => {
  if (!url) return null;
  try { return Linking.parse(url).queryParams?.invite?.toString() ?? null; } catch { return null; }
};

export function StoreProvider({ children, showSplash = true }: { children: ReactNode; showSplash?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [screen, setScreen] = useState<Screen>(showSplash ? "splash" : "home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [params, setParamsState] = useState<BrewParams>(METHOD_DEFAULTS.filter);
  const [base, setBase] = useState<BrewParams>(METHOD_DEFAULTS.filter);
  const [ratePrompt, setRatePrompt] = useState<Brew | null>(null);
  const [editTarget, setEditTarget] = useState<Brew | null>(null);
  const [tagTarget, setTagTarget] = useState<Brew | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [tags, setTags] = useState<FlavourTag[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  // "auto" shows the guide while the server says the user has not seen it; the GUIDE link forces it open.
  const [guide, setGuide] = useState<"auto" | "open" | "closed">("auto");
  const [roasterFocus, setRoasterFocus] = useState<string | null>(null);
  const [ticketSource, setTicketSource] = useState<TicketSource | null>(null);
  const [scope, setScope] = useState<RoasterScope>("mine");
  const [friends, setFriends] = useState<Friends | null>(null);
  const [friendsError, setFriendsError] = useState<string | null>(null);
  // A friendship starts with a link; following it is what puts the token in front of the app.
  const [invite, setInvite] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stampT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    Linking.getInitialURL().then((u) => { const t = inviteFrom(u); if (alive && t) setInvite(t); });
    const sub = Linking.addEventListener("url", (e) => { const t = inviteFrom(e.url); if (t) { setInvite(t); setScreen("friends"); } });
    return () => { alive = false; sub.remove(); };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [m, bs, brs] = await Promise.all([api.me(), api.beans(), api.brews()]);
      setMe(m); setBeans(bs); setBrews(brs); setError(null); setSignedIn(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The brew log could not be reached.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { setSignedOutHandler(() => setSignedIn(false)); }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { if (toastT.current) clearTimeout(toastT.current); if (stampT.current) clearTimeout(stampT.current); }, []);

  const signIn = useCallback(async () => { setLoading(true); setError(null); await refresh(); }, [refresh]);
  const signOut = useCallback(async () => {
    // oauth2-proxy answers sign_out by expiring its cookie; fetch shares the jar with the WebView.
    try { await fetch(api.signOutUrl, { credentials: "include" }); } catch { /* the cookie goes either way */ }
    setMe(null); setBeans([]); setBrews([]); setFriends(null); setCurrentId(null);
    setScreen("home"); setSheet(null); setSignedIn(false);
  }, []);

  const beansOpen = useMemo(() => beans.filter((b) => !b.archived), [beans]);
  const beansArchived = useMemo(() => beans.filter((b) => b.archived), [beans]);

  // The current bag: explicit pick, else the most recently brewed open bag, else the newest open bag.
  const currentBean = useMemo(() => {
    if (currentId) { const b = beans.find((x) => x.id === currentId); if (b) return b; }
    const brewed = beansOpen.filter((b) => b.lastBrewedAt).sort((a, b) => b.lastBrewedAt!.localeCompare(a.lastBrewedAt!));
    return brewed[0] ?? beansOpen[0] ?? null;
  }, [beans, beansOpen, currentId]);

  // Switching bags re-baselines the ticket on that bag's last brew.
  const lastSeenBean = useRef<string | null>(null);
  useEffect(() => {
    if (!currentBean) return;
    if (lastSeenBean.current === currentBean.id) return;
    lastSeenBean.current = currentBean.id;
    setParamsState(currentBean.lastParams);
    setBase(currentBean.lastParams);
    setTicketSource(null);
  }, [currentBean]);

  const brewsFor = useCallback((beanId: string) => brews.filter((b) => b.beanId === beanId), [brews]);
  const nextNumber = brews.reduce((m, b) => Math.max(m, b.number), 0) + 1;

  const showToast = useCallback((msg: string, undo?: () => void, label?: string) => {
    if (toastT.current) clearTimeout(toastT.current);
    setToast({ msg, undo, label });
    toastT.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // A stamp landed on the passport: say which, and offer the way there.
  const celebrate = (unlocked: Unlocked[]) => {
    if (unlocked.length === 0) return;
    showToast(`✦ Passport stamped — ${unlocked.map((u) => u.title.toUpperCase()).join(", ")}`, () => { setToast(null); setScreen("passport"); }, "PASSPORT →");
  };

  const setParam = (key: Exclude<keyof BrewParams, "method">, value: number) => setParamsState((p) => ({ ...p, [key]: value }));
  const lastOfMethod = useCallback((m: BrewMethod) => (currentBean ? brewsFor(currentBean.id).find((b) => b.params.method === m) ?? null : null), [currentBean, brewsFor]);
  const setMethod = (m: BrewMethod) => {
    const next = lastOfMethod(m)?.params ?? METHOD_DEFAULTS[m];
    setParamsState(next);
    setBase(next);
    setTicketSource(null);
  };
  const loadParams = (p: BrewParams, source: TicketSource | null = null) => { setParamsState(p); setTicketSource(source); };

  const patchBean = (bean: Bean) => setBeans((bs) => bs.map((b) => (b.id === bean.id ? bean : b)));

  const commitBrew = async (durationMs: number | null, steps: BrewStep[]) => {
    if (!currentBean) return;
    const bean = currentBean;
    const p = params;
    const prevBase = base;
    try {
      const brew = await api.createBrew(bean.id, p, durationMs, steps);
      setBrews((bs) => [brew, ...bs]);
      patchBean({ ...bean, brewCount: bean.brewCount + 1, lastBrewedAt: brew.brewedAt, lastParams: p });
      setBase(p);
      setTicketSource(null);
      setTags([]);
      // Rating is instant: the card comes up with the brew (§6). Undo sits quietly in the toast.
      setRatePrompt(brew);
      showToast(`Brew N° ${brew.number} logged — ${durationMs ? fmtTime(durationMs) : "untimed"}`, () => {
        if (stampT.current) clearTimeout(stampT.current);
        setRatePrompt(null);
        setToast(null);
        void api.deleteBrew(brew.id).then(() => {
          setBrews((bs) => bs.filter((b) => b.id !== brew.id));
          patchBean(bean);
          setBase(prevBase);
        }).catch(() => showToast("Could not undo — the brew stays logged"));
      });
      if (stampT.current) clearTimeout(stampT.current);
      // The undo toast keeps its slot; a stamp earned by this brew shows once that has passed.
      stampT.current = setTimeout(() => celebrate(brew.newlyUnlocked), STAMP_TOAST_DELAY_MS);
    } catch (e) {
      showToast(e instanceof ApiError ? `Not logged — ${e.message}` : "Not logged — the brew log could not be reached");
    }
  };

  const setBrewDuration = async (brewId: string, durationMs: number) => {
    try {
      foldBrew(await api.updateBrew(brewId, { durationMs }));
    } catch {
      showToast("Time not saved");
    }
  };

  const foldBrew = (updated: Brew) => {
    setBrews((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));
    setRatePrompt((r) => (r?.id === updated.id ? updated : r));
    setEditTarget((t) => (t?.id === updated.id ? updated : t));
  };

  const rateBrew = async (brewId: string, rating: number | null, defects: string[] | null) => {
    try {
      const updated = await api.rateBrew(brewId, rating, defects);
      foldBrew(updated);
      if (updated.newlyUnlocked.length) celebrate(updated.newlyUnlocked);
    } catch {
      showToast("Rating not saved");
    }
  };

  const openBrewEdit = (brew: Brew) => { setEditTarget(brew); setScreen("brewedit"); };

  // The bag's summary follows its newest brew; when that brew changes or goes, so does the ticket's base.
  const rebaseBean = (beanId: string, remaining: Brew[]) => {
    const bean = beans.find((b) => b.id === beanId);
    if (!bean) return;
    const newest = remaining.filter((b) => b.beanId === beanId).sort((a, b) => b.number - a.number)[0] ?? null;
    const lastParams = newest?.params ?? METHOD_DEFAULTS.filter;
    patchBean({ ...bean, brewCount: remaining.filter((b) => b.beanId === beanId).length, lastBrewedAt: newest?.brewedAt ?? null, lastParams });
    if (currentBean?.id === beanId) {
      const untouched = sameParams(params, base);
      setBase(lastParams);
      if (untouched) setParamsState(lastParams);
    }
  };

  const updateBrew = async (brewId: string, patch: UpdateBrew) => {
    try {
      const updated = await api.updateBrew(brewId, patch);
      const next = brews.map((b) => (b.id === updated.id ? updated : b));
      setBrews(next);
      setRatePrompt((r) => (r?.id === updated.id ? updated : r));
      setEditTarget((t) => (t?.id === updated.id ? updated : t));
      rebaseBean(updated.beanId, next);
      if (updated.newlyUnlocked.length) celebrate(updated.newlyUnlocked);
      return true;
    } catch (e) {
      showToast(e instanceof ApiError ? `Not saved — ${e.message}` : "Not saved — the brew log could not be reached");
      return false;
    }
  };

  const deleteBrew = async (brewId: string) => {
    const brew = brews.find((b) => b.id === brewId);
    if (!brew) return false;
    try {
      await api.deleteBrew(brewId);
      const next = brews.filter((b) => b.id !== brewId);
      setBrews(next);
      setRatePrompt((r) => (r?.id === brewId ? null : r));
      setEditTarget((t) => (t?.id === brewId ? null : t));
      rebaseBean(brew.beanId, next);
      showToast(`N° ${String(brew.number).padStart(3, "0")} deleted`);
      return true;
    } catch {
      showToast("Could not delete — the brew stays logged");
      return false;
    }
  };

  const openWheel = (brew?: Brew | null) => {
    const target = brew ?? brewsFor(currentBean?.id ?? "")[0] ?? null;
    setTagTarget(target);
    setTags(target ? target.flavourTags : []);
    setWheelOpen(true);
  };

  const closeWheel = async () => {
    setWheelOpen(false);
    const n = tags.length;
    if (!tagTarget) {
      if (n) showToast("Tags need a logged brew — brew first, then tag");
      return;
    }
    const before = tagTarget.flavourTags;
    const unchanged = before.length === tags.length && before.every((t) => tags.some((u) => u.flavour === t.flavour && u.polarity === t.polarity));
    if (unchanged) return;
    try {
      const updated = await api.tagBrew(tagTarget.id, tags);
      setBrews((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));
      if (updated.newlyUnlocked.length) celebrate(updated.newlyUnlocked);
      else showToast(n ? `${n} ${n === 1 ? "flavour" : "flavours"} tagged` : "Tags cleared");
    } catch {
      showToast("Tags not saved");
    }
  };

  const addBean = (bean: Bean) => { setBeans((bs) => [bean, ...bs]); setCurrentId(bean.id); };
  const archiveBean = async (id: string, archived: boolean) => {
    try { patchBean(await api.archiveBean(id, archived)); } catch { showToast("Could not update the bag"); }
  };
  const keepBean = async (id: string) => {
    try { patchBean(await api.keepBean(id)); } catch { showToast("Could not update the bag"); }
  };

  const setBrewPrivacy = async (brewId: string, isPrivate: boolean) => {
    try {
      const updated = await api.setBrewPrivacy(brewId, isPrivate);
      setBrews((bs) => bs.map((b) => (b.id === updated.id ? { ...b, isPrivate: updated.isPrivate } : b)));
      showToast(isPrivate ? `N° ${updated.number} is private` : `N° ${updated.number} is shared with friends`);
    } catch { showToast("Could not change who sees this brew"); }
  };

  const setSharing = async (share: boolean) => {
    if (!me) return;
    setMe({ ...me, shareRatedByDefault: share });
    try { setMe(await api.setSharing(share)); }
    catch { setMe({ ...me, shareRatedByDefault: !share }); showToast("Setting not saved"); }
  };

  // Once accepted or dismissed the token is gone; there is no address bar to reopen it from.
  const clearInvite = () => setInvite(null);

  const loadFriends = useCallback(async () => {
    try { setFriends(await api.friends()); setFriendsError(null); }
    catch (e) { setFriendsError(e instanceof ApiError ? e.message : "Your friends could not be reached."); }
  }, []);

  // A capability the deployment does not have is not a capability the client offers.
  const hasFriends = me?.features?.friends ?? false;

  const guideOpen = guide === "open" || (guide === "auto" && me?.onboardedAt === null);
  const openGuide = () => setGuide("open");
  const closeGuide = () => {
    setGuide("closed");
    if (!me || me.onboardedAt !== null) return;
    // Stamped server-side so it holds across devices; the local copy keeps the guide from reopening meanwhile.
    setMe({ ...me, onboardedAt: new Date().toISOString() });
    api.markOnboarded().then(setMe).catch(() => showToast("Guide not marked as seen — it may open once more"));
  };

  const value: Store = {
    loading, error, signedIn, signIn, signOut, me, beans, brews, screen, setScreen, sheet, setSheet,
    currentBean, selectBean: setCurrentId, beansOpen, beansArchived, brewsFor, nextNumber,
    params, base, setParam, setMethod, lastOfMethod, setParams: setParamsState, loadParams, ticketSource,
    commitBrew, setBrewDuration, rateBrew, ratePrompt, dismissRatePrompt: () => setRatePrompt(null),
    editTarget, openBrewEdit, updateBrew, deleteBrew,
    tagTarget, wheelOpen, openWheel, closeWheel, tags, setTags,
    addBean, patchBean, archiveBean, keepBean, setBrewPrivacy, setSharing,
    hasFriends, scope: hasFriends ? scope : "mine", setScope, friends, friendsError, loadFriends,
    invite: hasFriends ? invite : null, clearInvite,
    guideOpen, openGuide, closeGuide, roasterFocus, setRoasterFocus, toast, showToast, refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export const useChangeCount = () => {
  const { params, base } = useStore();
  return changedKeys(params, base).length;
};
