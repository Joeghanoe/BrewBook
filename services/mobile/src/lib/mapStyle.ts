// Near-black land, water one shade darker, roads a muted copper, no points of interest. The
// map should read as part of the app, not a window onto someone else's product. Applied where the
// provider honours a style (Google); Apple Maps on iOS keeps its own dark look.
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
