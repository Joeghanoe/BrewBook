// The flavour wheel. Nine wedges; each opens a fan of sub-groups whose leaves are the taggable flavours.
export interface FlavourGroup { name: string; leaves: string[] }
export interface FlavourCategory { name: string; groups: FlavourGroup[] }

export const WHEEL: FlavourCategory[] = [
  { name: "FRUITY", groups: [
    { name: "BERRY", leaves: ["Blackberry", "Raspberry", "Blueberry", "Strawberry"] },
    { name: "DRIED", leaves: ["Raisin", "Prune", "Fig", "Date"] },
    { name: "CITRUS", leaves: ["Lemon", "Lime", "Orange", "Grapefruit"] },
    { name: "STONE", leaves: ["Peach", "Cherry", "Plum"] },
  ] },
  { name: "FLORAL", groups: [
    { name: "FLOWERS", leaves: ["Jasmine", "Rose", "Chamomile", "Lavender"] },
    { name: "TEA", leaves: ["Black tea", "Earl grey", "Hibiscus"] },
  ] },
  { name: "SWEET", groups: [
    { name: "SUGARS", leaves: ["Honey", "Caramel", "Panela", "Brown sugar", "Molasses"] },
    { name: "CONFECTION", leaves: ["Vanilla", "Toffee", "Butterscotch", "Maple"] },
  ] },
  { name: "NUTTY", groups: [
    { name: "NUTS", leaves: ["Almond", "Hazelnut", "Peanut", "Walnut", "Pecan"] },
    { name: "PASTE", leaves: ["Marzipan", "Praline"] },
  ] },
  { name: "COCOA", groups: [
    { name: "CHOCOLATE", leaves: ["Dark chocolate", "Milk chocolate", "Cocoa nibs", "Fudge"] },
  ] },
  { name: "SPICES", groups: [
    { name: "WARM", leaves: ["Cinnamon", "Clove", "Nutmeg", "Cardamom"] },
    { name: "SHARP", leaves: ["Black pepper", "Anise", "Ginger", "Liquorice"] },
  ] },
  { name: "ROASTED", groups: [
    { name: "TOASTED", leaves: ["Toast", "Cereal", "Malt", "Bread"] },
    { name: "SMOKY", leaves: ["Smoky", "Tobacco", "Burnt", "Ashy"] },
  ] },
  { name: "GREEN", groups: [
    { name: "VEGETAL", leaves: ["Grassy", "Herbal", "Hay", "Pea"] },
    { name: "UNDER-RIPE", leaves: ["Under-ripe", "Raw", "Olive"] },
  ] },
  { name: "OTHER", groups: [
    { name: "FERMENTED", leaves: ["Winey", "Boozy", "Funky", "Fermented"] },
    { name: "TEXTURE", leaves: ["Creamy", "Juicy", "Woody", "Papery"] },
  ] },
];

const leafIndex = new Map<string, { category: string; group: string }>();
for (const c of WHEEL) for (const g of c.groups) for (const l of g.leaves) leafIndex.set(l.toLowerCase(), { category: c.name, group: g.name });

export const categoryOf = (leaf: string) => leafIndex.get(leaf.toLowerCase())?.category ?? "OTHER";
export const groupOf = (leaf: string) => leafIndex.get(leaf.toLowerCase())?.group ?? null;
