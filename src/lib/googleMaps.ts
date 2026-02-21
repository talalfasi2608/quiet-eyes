/**
 * Shared Google Maps loader — ensures the API is loaded exactly once.
 * Starts loading immediately on import (module-level side effect).
 */

const GOOGLE_MAPS_LOADED = '__gmaps_loaded__';

let loadPromise: Promise<void> | null = null;

export function loadGoogleMaps(): Promise<void> {
  // Already fully loaded
  if ((window as any)[GOOGLE_MAPS_LOADED] || window.google?.maps) {
    (window as any)[GOOGLE_MAPS_LOADED] = true;
    return Promise.resolve();
  }

  // Already loading — return the same promise
  if (loadPromise) return loadPromise;

  const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));

  loadPromise = new Promise<void>((resolve, reject) => {
    // Remove ALL existing Google Maps script tags to prevent duplicates
    document.querySelectorAll('script[src*="maps.googleapis.com/maps/api/js"]').forEach(el => el.remove());

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=he&loading=async`;
    script.async = true;
    script.onload = () => {
      (window as any)[GOOGLE_MAPS_LOADED] = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Google Maps failed to load'));
    document.head.appendChild(script);
  });

  return loadPromise;
}

// Start loading immediately when this module is first imported
loadGoogleMaps().catch(() => {});
