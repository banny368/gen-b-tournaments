"use client";

import { useEffect } from "react";

/** Registers the service worker (PWA installability + offline fallback). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW is an enhancement; ignore failures */
      });
    }
  }, []);
  return null;
}
