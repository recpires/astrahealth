"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Registers the offline service worker (public/sw.js) in production builds.
 * Online behaviour does not change: the worker always tries the network first.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* offline support is optional: the app works without it */
    });
  }, []);
  return null;
}

function subscribe(onChange: () => void) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return () => {};
  navigator.serviceWorker.addEventListener("controllerchange", onChange);
  return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
}

/** True when a service worker controls this page, i.e. the app can be reloaded without network. */
export function useOfflineReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof navigator !== "undefined" && "serviceWorker" in navigator && Boolean(navigator.serviceWorker.controller),
    () => false,
  );
}
