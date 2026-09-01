import { useEffect, useState } from "react";
import { clock } from "../lib/format";

export function useClock() {
  const [now, setNow] = useState(() => clock(new Date()));
  useEffect(() => {
    const id = window.setInterval(() => setNow(clock(new Date())), 10_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
