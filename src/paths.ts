// Vite `base` ("./") so the build works under /NazoRiver-web/ or any subfolder.
const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "./";

/** Resolve a public/ asset for the current page URL (matches what <img>.src becomes). */
export function asset(path: string): string {
  if (!path || /^(?:https?:|data:|blob:)/.test(path)) return path;
  const clean = path.replace(/^\//, "");
  if (typeof window !== "undefined") {
    return new URL(`${base}${clean}`, window.location.href).href;
  }
  return `${base}${clean}`;
}
