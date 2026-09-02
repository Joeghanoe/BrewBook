// Loads the Maps JavaScript API at runtime with the key the API hands out (/api/v1/config), so
// no key is baked into the bundle and no npm package is needed. Only the surface the roaster
// map uses is typed here.

export interface LatLngLiteral { lat: number; lng: number }
export interface GBounds { extend(p: LatLngLiteral): GBounds; isEmpty(): boolean }
export interface GMap {
  fitBounds(b: GBounds, padding?: number): void;
  panTo(p: LatLngLiteral): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
}
export interface GMarker { setMap(m: GMap | null): void; addListener(event: string, fn: () => void): void }
export interface GoogleMaps {
  Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMap;
  Marker: new (opts: Record<string, unknown>) => GMarker;
  LatLngBounds: new () => GBounds;
  SymbolPath: { CIRCLE: unknown };
}

declare global {
  interface Window { google?: { maps?: GoogleMaps }; __brewbookMapsReady?: () => void }
}

const LOAD_TIMEOUT_MS = 15_000;
let pending: Promise<GoogleMaps> | null = null;

export const loadGoogleMaps = (key: string): Promise<GoogleMaps> => {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (pending) return pending;
  pending = new Promise<GoogleMaps>((resolve, reject) => {
    const fail = (why: string) => { pending = null; reject(new Error(why)); };
    const timer = window.setTimeout(() => fail("the map did not load"), LOAD_TIMEOUT_MS);
    window.__brewbookMapsReady = () => {
      window.clearTimeout(timer);
      const maps = window.google?.maps;
      if (maps) resolve(maps); else fail("the map did not load");
    };
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=__brewbookMapsReady`;
    s.async = true;
    s.onerror = () => { window.clearTimeout(timer); fail("the map could not be reached"); };
    document.head.appendChild(s);
  });
  return pending;
};

// Near-black land, water one shade darker, roads a muted copper, no points of interest. The
// map should read as part of the app, not a window onto someone else's product.
export const MAP_STYLE = [
  { elementType: "geometry", stylers: [{ color: "#1c1a21" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a7d63" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141318" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#3a3440" }] },
  { featureType: "administrative.country", elementType: "geometry.stroke", stylers: [{ color: "#4a4150" }] },
  { featureType: "administrative.land_parcel", stylers: [{ visibility: "off" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#1c1a21" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#1f1c24" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#3b3129" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ visibility: "off" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#473a2e" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#5a4633" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a7a62" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#141318" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4d4a56" }] },
];
