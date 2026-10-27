"use client";
import { useEffect, useState } from "react";
interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export default function PwaSupport() {
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => console.warn("CMMS: service worker registration failed"));
    }
    const offer = (event: Event) => {
      event.preventDefault();
      if (!window.matchMedia("(display-mode: standalone)").matches) setInstall(event as InstallEvent);
    };
    const installed = () => setInstall(null);
    const status = () => setOffline(!navigator.onLine);
    status();
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", installed);
    window.addEventListener("online", status);
    window.addEventListener("offline", status);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", installed);
      window.removeEventListener("online", status);
      window.removeEventListener("offline", status);
    };
  }, []);
  return <>
    {offline && <div className="pwa-offline" role="status">ออฟไลน์ — กรุณาเชื่อมต่ออินเทอร์เน็ตก่อนบันทึกงาน</div>}
    {install && <aside className="pwa-install" aria-label="ติดตั้งแอป">
      <button type="button" onClick={async () => {
        const event = install;
        setInstall(null);
        try { await event.prompt(); await event.userChoice; } catch { /* Browser dismissed the prompt. */ }
      }}>ติดตั้ง AGE CMMS</button>
      <button type="button" aria-label="ปิดคำแนะนำติดตั้ง" onClick={() => setInstall(null)}>×</button>
    </aside>}
  </>;
}
