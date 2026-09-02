import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError } from "../api/client";
import type { Bean, Brew, BrewParams, FlavourTag, Me, Unlocked } from "../api/types";
import { sameParams } from "../lib/format";

export type Screen = "splash" | "home" | "timer" | "bean" | "library" | "scan" | "scanform" | "profile" | "roasters" | "passport";
export type Sheet = null | "adjust" | "switcher";

/** `label` names the action button; it reads UNDO when absent. */
export interface Toast { msg: string; undo?: () => void; label?: string }

export const METHOD_DEFAULTS: BrewParams = { grind: 4.5, doseG: 15, yieldG: 250, tempC: 94, blooms: 2 };
const RATE_PROMPT_DELAY_MS = 6000;
const TOAST_MS = 4200;

interface Store {
  loading: boolean;
  error: string | null;
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
  setParam: (key: keyof BrewParams, value: number) => void;
  setParams: (p: BrewParams) => void;
  loadParams: (p: BrewParams) => void;

  commitBrew: (durationMs: number, pourMarkersMs: number[]) => Promise<void>;
  rateBrew: (brewId: string, rating: number | null, defects: string[] | null) => Promise<void>;
  ratePrompt: Brew | null;
  dismissRatePrompt: () => void;

  tagTarget: Brew | null;
  wheelOpen: boolean;
  openWheel: (brew?: Brew | null) => void;
  closeWheel: () => Promise<void>;
  tags: FlavourTag[];
  setTags: (t: FlavourTag[]) => void;

  addBean: (bean: Bean) => void;
  archiveBean: (id: string, archived: boolean) => Promise<void>;

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

export function StoreProvider({ children, showSplash = true }: { children: ReactNode; showSplash?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [beans, setBeans] = useState<Bean[]>([]);
  const [brews, setBrews] = useState<Brew[]>([]);
  const [screen, setScreen] = useState<Screen>(showSplash ? "splash" : "home");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [params, setParamsState] = useState<BrewParams>(METHOD_DEFAULTS);
  const [base, setBase] = useState<BrewParams>(METHOD_DEFAULTS);
  const [ratePrompt, setRatePrompt] = useState<Brew | null>(null);
  const [tagTarget, setTagTarget] = useState<Brew | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [tags, setTags] = useState<FlavourTag[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  // "auto" shows the guide while the server says the user has not seen it; the GUIDE link forces it open.
  const [guide, setGuide] = useState<"auto" | "open" | "closed">("auto");
  const [roasterFocus, setRoasterFocus] = useState<string | null>(null);
  const toastT = useRef<number>(0);
  const rateT = useRef<number>(0);

  const refresh = useCallback(async () => {
    try {
      const [m, bs, brs] = await Promise.all([api.me(), api.beans(), api.brews()]);
      setMe(m); setBeans(bs); setBrews(brs); setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "The brew log could not be reached.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => () => { window.clearTimeout(toastT.current); window.clearTimeout(rateT.current); }, []);

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
  }, [currentBean]);

  const brewsFor = useCallback((beanId: string) => brews.filter((b) => b.beanId === beanId), [brews]);
  const nextNumber = brews.reduce((m, b) => Math.max(m, b.number), 0) + 1;

  const showToast = useCallback((msg: string, undo?: () => void, label?: string) => {
    window.clearTimeout(toastT.current);
    setToast({ msg, undo, label });
    toastT.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  // A stamp landed on the passport: say which, and offer the way there.
  const celebrate = (unlocked: Unlocked[]) => {
    if (unlocked.length === 0) return;
    showToast(`✦ Passport stamped — ${unlocked.map((u) => u.title.toUpperCase()).join(", ")}`, () => { setToast(null); setScreen("passport"); }, "PASSPORT →");
  };

  const setParam = (key: keyof BrewParams, value: number) => setParamsState((p) => ({ ...p, [key]: value }));
  const loadParams = (p: BrewParams) => setParamsState(p);

  const patchBean = (bean: Bean) => setBeans((bs) => bs.map((b) => (b.id === bean.id ? bean : b)));

  const commitBrew = async (durationMs: number, pourMarkersMs: number[]) => {
    if (!currentBean) return;
    const bean = currentBean;
    const p = params;
    const prevBase = base;
    try {
      const brew = await api.createBrew(bean.id, p, durationMs, pourMarkersMs);
      setBrews((bs) => [brew, ...bs]);
      patchBean({ ...bean, brewCount: bean.brewCount + 1, lastBrewedAt: brew.brewedAt, lastParams: p });
      setBase(p);
      setTags([]);
      showToast(`Brew N° ${brew.number} logged — ${msToClock(durationMs)}`, () => {
        window.clearTimeout(rateT.current);
        setRatePrompt(null);
        setToast(null);
        void api.deleteBrew(brew.id).then(() => {
          setBrews((bs) => bs.filter((b) => b.id !== brew.id));
          patchBean(bean);
          setBase(prevBase);
        }).catch(() => showToast("Could not undo — the brew stays logged"));
      });
      window.clearTimeout(rateT.current);
      // The undo toast keeps its slot; a stamp earned by this brew shows once that has passed.
      rateT.current = window.setTimeout(() => { setRatePrompt(brew); celebrate(brew.newlyUnlocked); }, RATE_PROMPT_DELAY_MS);
    } catch (e) {
      showToast(e instanceof ApiError ? `Not logged — ${e.message}` : "Not logged — the brew log could not be reached");
    }
  };

  const rateBrew = async (brewId: string, rating: number | null, defects: string[] | null) => {
    try {
      const updated = await api.rateBrew(brewId, rating, defects);
      setBrews((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      showToast("Rating not saved");
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
    loading, error, me, beans, brews, screen, setScreen, sheet, setSheet,
    currentBean, selectBean: setCurrentId, beansOpen, beansArchived, brewsFor, nextNumber,
    params, base, setParam, setParams: setParamsState, loadParams,
    commitBrew, rateBrew, ratePrompt, dismissRatePrompt: () => setRatePrompt(null),
    tagTarget, wheelOpen, openWheel, closeWheel, tags, setTags,
    addBean, archiveBean, guideOpen, openGuide, closeGuide, roasterFocus, setRoasterFocus, toast, showToast, refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const msToClock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore outside StoreProvider");
  return s;
}

export const useChangeCount = () => {
  const { params, base } = useStore();
  return sameParams(params, base) ? 0 : (Object.keys(params) as (keyof BrewParams)[]).filter((k) => params[k] !== base[k]).length;
};
