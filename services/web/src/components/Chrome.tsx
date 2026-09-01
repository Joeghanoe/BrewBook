import { useClock } from "../hooks/useClock";
import { useStore } from "../state/store";

export const StatusBar = () => {
  const now = useClock();
  return (
    <div className="statusbar">
      <span>{now}</span>
      <div className="battery"><div /></div>
    </div>
  );
};

export const HomeBar = () => <div className="homebar"><div /></div>;
export const Grabber = () => <div className="grabber"><div /></div>;

export const Rule = ({ label, right }: { label: string; right?: string }) => (
  <div className="rule"><span>{label}</span><div className="line" />{right !== undefined && <span className="dim">{right}</span>}</div>
);

export const Toast = () => {
  const { toast } = useStore();
  if (!toast) return null;
  return (
    <div className="toast">
      <span>{toast.msg}</span>
      {toast.undo && <button onClick={toast.undo}>UNDO</button>}
    </div>
  );
};

export const Star = () => <span className="star">✦</span>;
