import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Ellipse, G, Path, Text as SText } from "react-native-svg";
import { Pop, SheetRise } from "../components/Anim";
import { Backdrop, Chip, Chips, Cta, Grabber, Hint, Leaf, Rule, SqBtn } from "../components/Chrome";
import { useLongPress } from "../hooks/useLongPress";
import { categoryOf, groupOf, WHEEL, type FlavourCategory } from "../lib/flavours";
import { whenLabel } from "../lib/format";
import { annular, polar, wedgeAngles, WHEEL_GEOMETRY } from "../lib/wheelGeometry";
import { useStore } from "../state/store";
import { c, g } from "../theme/text";
import { C, courier, grotesk, shadowSheet } from "../theme/tokens";
import { useBlinkTransform } from "../components/Anim";
import { Animated } from "react-native";

const AG = Animated.createAnimatedComponent(G);

const COPPER_FILL = "rgba(194,144,94,.07)", COPPER_FILL_ON = "rgba(194,144,94,.30)", COPPER_STROKE = "rgba(194,144,94,.55)";
const RUST_FILL = "rgba(161,85,63,.22)", RUST_STROKE = "rgba(161,85,63,.7)";

interface Counts { pos: number; neg: number }
const useCounts = () => {
  const { tags } = useStore();
  const byCat = new Map<string, Counts>();
  const byGroup = new Map<string, Counts>();
  for (const t of tags) {
    const cat = categoryOf(t.flavour), grp = groupOf(t.flavour) ?? "";
    const cc = byCat.get(cat) ?? { pos: 0, neg: 0 }; const gc = byGroup.get(cat + "/" + grp) ?? { pos: 0, neg: 0 };
    if (t.polarity > 0) { cc.pos++; gc.pos++; } else { cc.neg++; gc.neg++; }
    byCat.set(cat, cc); byGroup.set(cat + "/" + grp, gc);
  }
  return { byCat, byGroup, total: tags.length };
};

const fillFor = (cnt: Counts | undefined, base = COPPER_FILL, on = COPPER_FILL_ON) =>
  !cnt || cnt.pos + cnt.neg === 0 ? base : cnt.pos === 0 ? RUST_FILL : on;
const strokeFor = (cnt: Counts | undefined) => (cnt && cnt.pos + cnt.neg > 0 && cnt.pos === 0 ? RUST_STROKE : COPPER_STROKE);

export const WheelLayer = () => {
  const s = useStore();
  const insets = useSafeAreaInsets();
  const [zoom, setZoom] = useState<FlavourCategory | null>(null);
  const { byCat, total } = useCounts();
  const { cx: CX, cy: CY, ro: RO, ri: RI, size, viewBox } = WHEEL_GEOMETRY, N = WHEEL.length;
  const blink = useBlinkTransform(4400, 170, 166);
  const subtitle = s.tagTarget ? `${s.currentBean?.name ?? "bean"} — ${whenLabel(s.tagTarget.brewedAt).toLowerCase()} · N° ${s.tagTarget.number}` : "no brew logged yet — tags need a brew";
  const done = () => { setZoom(null); void s.closeWheel(); };

  return (
    <>
      <Backdrop layer onPress={done} />
      <SheetRise style={[st.layer, { top: 64 + insets.top, paddingBottom: 14 + insets.bottom }]}>
        <View style={{ paddingTop: 10 }}><Grabber /></View>
        <View style={st.title}>
          <SqBtn onPress={zoom ? () => setZoom(null) : done} label={zoom ? "Back" : "Close"}>{zoom ? "←" : "✕"}</SqBtn>
          <View style={{ flex: 1, minWidth: 0 }}><Text style={st.t}>TAG FLAVOURS</Text><Text style={st.s} numberOfLines={1}>{subtitle}</Text></View>
        </View>
        {zoom ? (
          <ZoomView category={zoom} onBack={() => setZoom(null)} />
        ) : (
          <>
            <Rule label="ALL FLAVOURS" right={`${total} TAGGED`} style={{ marginTop: 14, marginHorizontal: 22 }} />
            <View style={{ alignItems: "center", paddingTop: 8 }}>
              <Pop>
                <Svg width={size} height={size} viewBox={viewBox} fill="none">
                  <G strokeWidth={1.2}>
                    {WHEEL.map((cat, i) => {
                      const { a0, a1 } = wedgeAngles(i, N);
                      const cnt = byCat.get(cat.name);
                      return <Path key={cat.name} d={annular(CX, CY, RO, RI, a0, a1)} fill={fillFor(cnt)} stroke={strokeFor(cnt)} onPress={() => setZoom(cat)} />;
                    })}
                  </G>
                  {WHEEL.map((cat, i) => { const [x, y] = polar(CX, CY, (RO + RI) / 2, wedgeAngles(i, N).mid); return <SText key={cat.name} x={x.toFixed(1)} y={(y + 4).toFixed(1)} fontFamily={grotesk(600)} fontSize={11} letterSpacing={1.5} fill="#e9d6ae" textAnchor="middle" pointerEvents="none">{cat.name}</SText>; })}
                  {WHEEL.map((cat, i) => {
                    const cnt = byCat.get(cat.name); if (!cnt || cnt.pos + cnt.neg === 0) return null;
                    const [x, y] = polar(CX, CY, RO - 8, wedgeAngles(i, N).a0 + 6);
                    const rust = cnt.pos === 0;
                    return (
                      <G key={cat.name} pointerEvents="none">
                        <Circle cx={x} cy={y} r={10} fill={rust ? "#a1553f" : "#c2905e"} />
                        <SText x={x} y={y + 4} fontFamily={courier(700)} fontSize={11} fill={rust ? "#e9d6ae" : "#1c1a21"} textAnchor="middle">{cnt.pos + cnt.neg}</SText>
                      </G>
                    );
                  })}
                  <AG stroke="#c2905e" strokeWidth={1.3} pointerEvents="none" transform={blink}>
                    <Path d="M148 166 Q170 146 192 166 Q170 186 148 166 Z" /><Ellipse cx={170} cy={166} rx={6.5} ry={7} />
                  </AG>
                </Svg>
              </Pop>
            </View>
            <Hint style={{ marginTop: 6, color: C.text45 }}>tap a wedge to open it</Hint>
          </>
        )}
        <View style={{ flex: 1 }} />
        <Chips style={{ paddingHorizontal: 22, paddingBottom: 14, minHeight: 44 }}>
          {s.tags.map((t) => (
            <Chip key={t.flavour} neg={t.polarity < 0} right="✕" onPress={() => s.setTags(s.tags.filter((x) => x.flavour !== t.flavour))}>
              {t.polarity < 0 ? "− " : ""}{t.flavour}
            </Chip>
          ))}
        </Chips>
        <View style={{ paddingHorizontal: 22 }}><Cta label="DONE" onPress={done} /></View>
      </SheetRise>
    </>
  );
};

const ZoomView = ({ category, onBack }: { category: FlavourCategory; onBack: () => void }) => {
  const { byGroup, total } = useCounts();
  const groups = category.groups;
  const CX = 195, CY = 175, RO = 118, RI = 56, STEP = 180 / groups.length;
  return (
    <>
      <View style={st.crumbs}>
        <Text onPress={onBack} style={[st.crumb, { paddingVertical: 8, paddingHorizontal: 4 }]}>← ALL FLAVOURS</Text>
        <Text style={[st.crumb, { color: C.copper60 }]}>/</Text>
        <Text style={[st.crumb, { color: C.copperLight }]}>{category.name}</Text>
        <View style={{ flex: 1, height: 1, backgroundColor: C.copper30 }} />
        <Text style={st.crumb}>{total} TAGGED</Text>
      </View>
      <View style={{ alignItems: "center" }}>
        <Pop duration={400}>
          <Svg width={390} height={150} viewBox="0 40 390 150" fill="none" style={{ maxWidth: "100%" }}>
            <G stroke={COPPER_STROKE} strokeWidth={1.2}>
              {groups.map((grp, i) => {
                const a0 = 180 + i * STEP, a1 = a0 + STEP;
                return <Path key={grp.name} d={annular(CX, CY, RO, RI, a0, a1)} fill={fillFor(byGroup.get(category.name + "/" + grp.name), "rgba(194,144,94,.08)", "rgba(194,144,94,.32)")} />;
              })}
            </G>
            {groups.map((grp, i) => { const [x, y] = polar(CX, CY, (RO + RI) / 2, 180 + (i + 0.5) * STEP); return <SText key={grp.name} x={x.toFixed(1)} y={(y + 4).toFixed(1)} fontFamily={grotesk(600)} fontSize={10} letterSpacing={1.5} fill="#e9d6ae" textAnchor="middle">{grp.name}</SText>; })}
            {groups.map((grp, i) => {
              const cnt = byGroup.get(category.name + "/" + grp.name); if (!cnt || cnt.pos + cnt.neg === 0) return null;
              const [x, y] = polar(CX, CY, RO - 8, 180 + i * STEP + 8);
              return (
                <G key={grp.name} pointerEvents="none">
                  <Circle cx={x} cy={y} r={9} fill="#c2905e" />
                  <SText x={x} y={y + 3.5} fontFamily={courier(700)} fontSize={10} fill="#1c1a21" textAnchor="middle">{cnt.pos + cnt.neg}</SText>
                </G>
              );
            })}
            <SText x={CX} y={CY - 12} fontFamily={grotesk(700)} fontSize={13} letterSpacing={4} fill="#d8a86f" textAnchor="middle">{category.name}</SText>
          </Svg>
        </Pop>
      </View>
      <ScrollView style={{ marginHorizontal: 22, flexGrow: 0 }} showsVerticalScrollIndicator={false}>
        {groups.map((grp, i) => (
          <View key={grp.name}>
            <Rule label={grp.name} style={{ marginTop: i ? 12 : 0 }} />
            <Chips compact style={{ marginTop: 8 }}>{grp.leaves.map((l) => <LeafBtn key={l} name={l} />)}</Chips>
          </View>
        ))}
      </ScrollView>
      <Hint style={{ marginTop: 8, color: C.text45 }}>tap to tag · long-press to mark a dislike</Hint>
    </>
  );
};

const LeafBtn = ({ name }: { name: string }) => {
  const { tags, setTags } = useStore();
  const cur = tags.find((t) => t.flavour === name);
  const others = tags.filter((t) => t.flavour !== name);
  const press = useLongPress(
    () => setTags(cur?.polarity === 1 ? others : [...others, { flavour: name, polarity: 1 }]),
    () => setTags(cur?.polarity === -1 ? others : [...others, { flavour: name, polarity: -1 }]),
  );
  return (
    <Leaf compact state={cur?.polarity === 1 ? "pos" : cur?.polarity === -1 ? "neg" : null} {...press}>
      {name}{cur?.polarity === 1 ? " ✓" : ""}
    </Leaf>
  );
};

const st = StyleSheet.create({
  layer: { position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 61, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.copper60, ...shadowSheet },
  title: { flexDirection: "row", alignItems: "center", gap: 14, paddingTop: 4, paddingHorizontal: 22 },
  t: g(700, 15, 4),
  s: { ...g(400, 12, 0, C.text55), marginTop: 2 },
  crumbs: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8, marginHorizontal: 22 },
  crumb: c(700, 10, 3, C.text60),
});
