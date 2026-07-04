import { useEffect } from "react";

// Guarded PWA service worker registration.
// Never registers in Lovable preview, iframe, dev, or when ?sw=off.
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const url = new URL(window.location.href);
    if (url.searchParams.get("sw") === "off") {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }

    if (!import.meta.env.PROD) return;
    if (window.self !== window.top) return;

    const host = window.location.hostname;
    if (
      host.startsWith("id-preview--") ||
      host.startsWith("preview--") ||
      host === "lovableproject.com" ||
      host.endsWith(".lovableproject.com") ||
      host === "lovableproject-dev.com" ||
      host.endsWith(".lovableproject-dev.com") ||
      host === "beta.lovable.dev" ||
      host.endsWith(".beta.lovable.dev")
    ) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) =>
          regs.forEach((r) => {
            if (r.active?.scriptURL.endsWith("/sw.js")) r.unregister();
          }),
        )
        .catch(() => {});
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("SW registration failed:", err);
    });
  }, []);

  return null;
}
