import { useRef, useState, type ReactNode } from "react";
import { Star } from "../components/Chrome";
import { CameraIcon, MicIcon, WheelIcon } from "../components/Icons";
import { useStore } from "../state/store";

const SWIPE_PX = 40;

interface Card { kicker: string; title: string; text: string; art: ReactNode }

const CARDS: Card[] = [
  {
    kicker: "01 · THE TICKET",
    title: "One ticket per bag",
    text: "The five values the next brew will use. Tap a value to adjust it. Every cell shows what it was last time, so the change is always in view.",
    art: <TicketArt />,
  },
  {
    kicker: "02 · BREWING",
    title: "Tap. Hold. Tap.",
    text: "Stopping logs the brew at once; undo is in the toast. While it runs, say a change out loud and it lands on the ticket live.",
    art: <TimerArt />,
  },
  {
    kicker: "03 · AFTER THE BREW",
    title: "Rate, then tag",
    text: "A rate card follows each brew: stars and defects, both skippable. On the wheel, tap a flavour to tag it, hold to mark one you disliked.",
    art: <RateArt />,
  },
  {
    kicker: "04 · BAGS",
    title: "Scan the label",
    text: "Add a bag by pointing the camera at its label. Anything unread is handed to you to type. Switch bags from the name at the top of the ticket; each keeps its own ticket and log.",
    art: <BagsArt />,
  },
];

export const Guide = () => {
  const s = useStore();
  const [i, setI] = useState(0);
  const downX = useRef<number | null>(null);
  const last = i === CARDS.length - 1;
  const card = CARDS[i];

  const next = () => setI((n) => Math.min(n + 1, CARDS.length - 1));
  const prev = () => setI((n) => Math.max(n - 1, 0));
  const start = () => { s.closeGuide(); s.setScreen("home"); };

  const onDown = (e: React.PointerEvent) => { downX.current = e.clientX; };
  const onUp = (e: React.PointerEvent) => {
    if (downX.current === null) return;
    const dx = e.clientX - downX.current;
    downX.current = null;
    if (dx < -SWIPE_PX) next();
    else if (dx > SWIPE_PX) prev();
    else if (!last) next();
  };

  return (
    <div className="screen guide">
      <div className="nav">
        {i > 0 ? <button className="sqbtn" onClick={prev} aria-label="Previous card">←</button> : <div style={{ width: 44 }} />}
        <div className="title">GUIDE</div>
        <div style={{ flex: 1 }} />
        <button className="link" style={{ minHeight: 44 }} onClick={s.closeGuide}>SKIP</button>
      </div>
      <div key={i} className="guide-card" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => { downX.current = null; }}>
        <div className="guide-art">{card.art}</div>
        <div className="guide-kicker">{card.kicker}</div>
        <div className="guide-title">{card.title}</div>
        <div className="guide-text">{card.text}</div>
      </div>
      <div className="guide-dots" aria-label={`Card ${i + 1} of ${CARDS.length}`}>
        {CARDS.map((_, n) => <div key={n} className={n === i ? "on" : ""} />)}
      </div>
      <div className="guide-foot">
        {last
          ? <button className="cta" onClick={start}><span>START BREWING</span></button>
          : <button className="outline" onClick={next}>NEXT →</button>}
      </div>
    </div>
  );
};

function TicketArt() {
  return (
    <div className="ticket guide-ticket">
      <div className="punch l" /><div className="punch r" />
      <div className="ticket-head"><span>BREW TICKET</span><span>N° 012</span></div>
      <div className="ticket-method"><Star /> FILTER · HAND GRINDER <Star /></div>
      <div className="ticket-grid">
        <div className="cell"><div className="label">GRIND</div><div className="value">4.0</div><div className="was">was 4.5</div><div className="mark" /></div>
        <div className="cell"><div className="label">WATER</div><div className="value">93<span>°C</span></div><div className="was">was 94</div><div className="mark" /></div>
        <div className="cell"><div className="label">DOSE</div><div className="value">15.0<span>g</span></div><div className="was" /><div className="mark" style={{ opacity: 0 }} /></div>
      </div>
      <div className="ticket-foot"><span>2 changes from last brew</span><span className="stamp">UNBREWED</span></div>
    </div>
  );
}

function TimerArt() {
  return (
    <>
      <div className="guide-dial">
        <div className="time">1:42</div>
        <div className="sub">target 2:30</div>
      </div>
      <div className="markers guide-markers">
        <div className="marker"><span>✦</span> POUR 0:30</div>
        <div className="marker"><span>✦</span> POUR 1:15</div>
      </div>
      <div className="guide-keys">
        <div><span>TAP</span>start · stop &amp; log</div>
        <div><span>HOLD</span>mark a pour</div>
        <div><span><MicIcon size={11} /></span>“half a click finer” → −0.5 FINER</div>
      </div>
    </>
  );
}

function RateArt() {
  return (
    <>
      <div className="guide-stars">{[1, 2, 3, 4, 5].map((n) => <div key={n} className={n <= 4 ? "on" : ""}>★</div>)}</div>
      <div className="defects guide-defects">
        <div className="defect on">Sour</div><div className="defect">Bitter</div><div className="defect">Thin</div><div className="defect">Harsh</div>
      </div>
      <div className="guide-leaves">
        <WheelIcon />
        <div><div className="leaf pos">Blackberry</div><div className="key">TAP · TAGGED</div></div>
        <div><div className="leaf neg">Smoky</div><div className="key">HOLD · DISLIKED</div></div>
      </div>
    </>
  );
}

function BagsArt() {
  return (
    <>
      <div className="guide-finder">
        <div className="bracket tl" /><div className="bracket tr" /><div className="bracket bl" /><div className="bracket br" />
        <div className="target"><CameraIcon /></div>
      </div>
      <div className="guide-switch">
        <div className="bean-name">EL CARMEN <span>⌄</span></div>
        <div className="bean-meta">Symple · 9 d off roast</div>
      </div>
    </>
  );
}
