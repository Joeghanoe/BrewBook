import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { ScanEye } from "../components/Icons";
import type { LabelScan } from "../api/types";
import { useStore } from "../state/store";

export interface ScanResult { scan: LabelScan; preview: string | null }

// Handed from Scan to ScanForm without a router: one module-level slot.
let pending: ScanResult | null = null;
export const takeScanResult = () => { const r = pending; pending = null; return r; };

export const Scan = () => {
  const s = useStore();
  const video = useRef<HTMLVideoElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;

  useEffect(() => {
    let live: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        live = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) { live.getTracks().forEach((t) => t.stop()); return; }
        setStream(live);
      } catch { /* no camera or denied: the shutter falls back to a file picker */ }
    })();
    return () => { cancelled = true; live?.getTracks().forEach((t) => t.stop()); };
  }, []);

  useEffect(() => { if (video.current && stream) { video.current.srcObject = stream; void video.current.play().catch(() => {}); } }, [stream]);

  const submit = async (blob: Blob, preview: string | null) => {
    setBusy(true); setStatus(null);
    try {
      const scan = await api.scanLabel(blob);
      pending = { scan, preview };
      s.setScreen("scanform");
    } catch (e) {
      setBusy(false);
      setStatus(e instanceof ApiError ? e.message.toUpperCase() : "COULD NOT REACH THE LABEL READER");
    }
  };

  const shutter = () => {
    if (busy) return;
    const v = video.current;
    if (stream && v && v.videoWidth) {
      const c = document.createElement("canvas");
      const scale = Math.min(1, 1600 / v.videoWidth);
      c.width = Math.round(v.videoWidth * scale); c.height = Math.round(v.videoHeight * scale);
      c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob((b) => { if (b) void submit(b, c.toDataURL("image/jpeg", 0.6)); }, "image/jpeg", 0.85);
      return;
    }
    file.current?.click();
  };

  const picked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    void submit(f, url);
  };

  return (
    <div className="screen scan">
      <div className="nav">
        <button className="sqbtn" onClick={() => s.setScreen("library")} aria-label="Close">✕</button>
        <div className="title">SCAN LABEL</div>
      </div>
      <div className="viewfinder">
        {stream && <video ref={video} playsInline muted />}
        <div className="bracket tl" /><div className="bracket tr" /><div className="bracket bl" /><div className="bracket br" />
        <div className="target-wrap">
          <div className="target">
            {busy ? <ScanEye /> : <span>{stream ? "align the bag's label inside the frame" : "no camera here — the shutter opens your photos"}</span>}
          </div>
          <div className="scan-status">
            {busy ? "READING LABEL…" : status ?? (!s.me?.features?.labelReading ? "LABEL READING NOT CONFIGURED · FILL IN BY HAND" : online ? "EXTRACTION RUNS OFF-DEVICE" : "OFFLINE · SCAN WHEN BACK ONLINE")}
          </div>
        </div>
      </div>
      <div className="shutter-wrap"><button className="shutter" onClick={shutter} aria-label="Capture label"><div /></button></div>
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
    </div>
  );
};
