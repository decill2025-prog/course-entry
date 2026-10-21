// Single guarded service-worker registrar. Never registers in dev, iframes or Lovable preview.
export async function registerNexusSW() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const h = location.hostname;
  const refused =
    !import.meta.env.PROD ||
    window.self !== window.top ||
    h.startsWith("id-preview--") ||
    h.startsWith("preview--") ||
    h === "lovableproject.com" || h.endsWith(".lovableproject.com") ||
    h === "lovableproject-dev.com" || h.endsWith(".lovableproject-dev.com") ||
    h === "beta.lovable.dev" || h.endsWith(".beta.lovable.dev") ||
    new URLSearchParams(location.search).has("sw");
  if (refused) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.filter((r) => r.active?.scriptURL.endsWith("/sw.js")).map((r) => r.unregister()),
    );
    return;
  }
  try {
    await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    // Once the worker controls the page, fetch "/" through it so the app opens on an offline reload.
    await navigator.serviceWorker.ready;
    const warm = () => fetch("/", { headers: { accept: "text/html" } }).catch(() => undefined);
    if (navigator.serviceWorker.controller) void warm();
    else navigator.serviceWorker.addEventListener("controllerchange", () => void warm(), { once: true });
  } catch (e) {
    console.warn("SW registration failed", e);
  }
}
