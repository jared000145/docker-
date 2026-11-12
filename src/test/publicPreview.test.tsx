import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { afterEach, expect, it, vi } from 'vitest';
import PublicApp from '@/PublicApp';

afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, '', '/'); });
it('opens the homepage and interactive demonstration without making backend requests', () => {
  localStorage.clear();
  window.history.replaceState({}, '', '/');
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Backend unavailable'));
  render(<HelmetProvider><PublicApp /></HelmetProvider>);
  expect(screen.getByRole('heading', { level: 1, name: /Votre établissement/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('link', { name: /Explorer la démonstration/ }));
  expect(screen.getByRole('heading', { level: 1, name: 'Vue d’ensemble' })).toBeInTheDocument();
  expect(window.location.pathname).toBe('/apercu');
  expect(fetch).not.toHaveBeenCalled();
});
