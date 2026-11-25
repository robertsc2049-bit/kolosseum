// What's open on a screen is a place of its own: it has an address, and Back
// closes it (public/app/route_bootstrap.js).
export function openedPlace(routeId: string, params: Record<string, string>) {
  document.dispatchEvent(new CustomEvent("kolosseum:place-opened", { detail: { route_id: routeId, params } }));
}

export function closedPlace(routeId: string) {
  document.dispatchEvent(new CustomEvent("kolosseum:place-closed", { detail: { route_id: routeId } }));
}

// Back on this screen. Returns how to stop listening.
export function onClosePlace(view: string, close: () => void): () => void {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ view?: string; opening?: boolean }>).detail;
    if (detail?.view === view && !detail.opening) close();
  };
  document.addEventListener("kolosseum:close-place", handler);
  return () => document.removeEventListener("kolosseum:close-place", handler);
}

// The address of something on this screen was followed.
export function onOpenPlace(event: string, key: string, open: (id: string) => void): () => void {
  const handler = (fired: Event) => {
    const id = (fired as CustomEvent<Record<string, unknown>>).detail?.[key];
    if (id) open(String(id));
  };
  document.addEventListener(event, handler);
  return () => document.removeEventListener(event, handler);
}
