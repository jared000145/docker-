import { useEffect, useState } from 'react';

export const RELEASE_POLL_MS = 30_000;
export const RELEASE_TIMEOUT_MS = 8_000;

export function useWebRelease(currentBuild: string, enabled: boolean) {
  const [available, setAvailable] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let pending: AbortController | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const check = async () => {
      if (pending || document.visibilityState === 'hidden' || !navigator.onLine) return;
      const controller = new AbortController();
      pending = controller;
      timeout = setTimeout(() => controller.abort(), RELEASE_TIMEOUT_MS);
      try {
        const response = await fetch('/version.json', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) return;
        const value: unknown = await response.json();
        if (!active || controller.signal.aborted || !value || typeof value !== 'object' || !('build' in value)) return;
        const build = value.build;
        if (typeof build !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(build)) return;
        // Clear an obsolete notice if a deployment is rolled back to this build.
        setAvailable(build === currentBuild ? null : build);
      } catch {
        // A failed check must never interrupt the current page or session.
      } finally {
        clearTimeout(timeout);
        pending = undefined;
      }
    };
    const refresh = () => { void check(); };
    const interval = setInterval(refresh, RELEASE_POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    refresh();
    return () => {
      active = false;
      pending?.abort();
      clearTimeout(timeout);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [currentBuild, enabled]);
  return available;
}
