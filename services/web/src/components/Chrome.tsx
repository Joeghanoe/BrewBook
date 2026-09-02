import { useStore } from "../state/store";

/**
 * The phone draws its own status bar, home indicator and safe areas (§9). Nothing here may
 * redraw them; screens get their insets from `.screen` in styles.css.
 */
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
      {toast.undo && <button onClick={toast.undo}>{toast.label ?? "UNDO"}</button>}
    </div>
  );
};

export const Star = () => <span className="star">✦</span>;
