export function setupPwa(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;

  ensureLink({ rel: "manifest", href: "/manifest.webmanifest" });
  ensureLink({ rel: "apple-touch-icon", href: "/icon.png" });
  ensureLink({ rel: "icon", href: "/icon.png", type: "image/png" });
  ensureMeta("apple-mobile-web-app-capable", "yes");
  ensureMeta("apple-mobile-web-app-status-bar-style", "default");
  ensureMeta("apple-mobile-web-app-title", "Cycle");
  ensureMeta("mobile-web-app-capable", "yes");

  if ("serviceWorker" in navigator && window.location.protocol === "https:") {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}

function ensureLink(attrs: { rel: string; href: string; type?: string }) {
  const selector = `link[rel="${attrs.rel}"]${attrs.type ? `[type="${attrs.type}"]` : ""}`;
  const existing = document.head.querySelector(selector);
  const el = (existing as HTMLLinkElement | null) ?? document.createElement("link");
  el.rel = attrs.rel;
  el.href = attrs.href;
  if (attrs.type) el.type = attrs.type;
  if (!existing) document.head.appendChild(el);
}

function ensureMeta(name: string, content: string) {
  const existing = document.head.querySelector(`meta[name="${name}"]`);
  const el = (existing as HTMLMetaElement | null) ?? document.createElement("meta");
  el.name = name;
  el.content = content;
  if (!existing) document.head.appendChild(el);
}
