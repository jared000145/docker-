import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RELEASE_POLL_MS, RELEASE_TIMEOUT_MS, useWebRelease } from '@/hooks/useWebRelease';

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
const response = (build: unknown) => ({ ok: true, json: async () => ({ build }) }) as Response;

it('detects a deployment without reloading and clears a rolled back version', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response('build-a'));
  const { result } = renderHook(() => useWebRelease('build-a', true));
  await act(async () => {});
  expect(result.current).toBeNull();
  fetch.mockResolvedValue(response('build-b'));
  await act(async () => { await vi.advanceTimersByTimeAsync(RELEASE_POLL_MS); });
  expect(result.current).toBe('build-b');
  expect(fetch).toHaveBeenLastCalledWith('/version.json', expect.objectContaining({ cache: 'no-store' }));
  fetch.mockResolvedValue(response('build-a'));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(result.current).toBeNull();
});

it('skips offline checks and detects a release when the network returns', async () => {
  const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response('build-b'));
  const { result } = renderHook(() => useWebRelease('build-a', true));
  expect(fetch).not.toHaveBeenCalled();
  online.mockReturnValue(true);
  await act(async () => { window.dispatchEvent(new Event('online')); });
  expect(result.current).toBe('build-b');
});

it('aborts a stalled request and retries without overlapping requests', async () => {
  let signal: AbortSignal | undefined;
  const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation((_url, options) => {
    signal = options?.signal as AbortSignal;
    return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))));
  });
  const { unmount } = renderHook(() => useWebRelease('build-a', true));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(RELEASE_TIMEOUT_MS); });
  expect(signal?.aborted).toBe(true);
  fetch.mockResolvedValue(response('build-b'));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
  await vi.advanceTimersByTimeAsync(RELEASE_POLL_MS);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('ignores malformed responses and keeps the current page available', async () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response(''));
  const { result } = renderHook(() => useWebRelease('build-a', true));
  await act(async () => {});
  expect(result.current).toBeNull();
  fetch.mockRejectedValue(new Error('offline'));
  await act(async () => { window.dispatchEvent(new Event('focus')); });
  expect(result.current).toBeNull();
});

it('does not poll an embedded Android build or another disabled environment', () => {
  const fetch = vi.spyOn(globalThis, 'fetch');
  renderHook(() => useWebRelease('build-a', false));
  expect(fetch).not.toHaveBeenCalled();
});
