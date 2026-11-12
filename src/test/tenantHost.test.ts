import { describe, expect, it, vi } from 'vitest';
import { getCustomDomainFromHost, getTenantSlugFromHost } from '@/hooks/useTenantSlug';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

describe('platform and institution hosts', () => {
  it.each([
    'rectorplus.vercel.app',
    'rectorplus-jareds-projects-7b8d0c08.vercel.app',
    'rectorplus-hty07pgqt-jareds-projects-7b8d0c08.vercel.app',
  ])('does not require institution membership on %s', host => {
    expect(getCustomDomainFromHost(host)).toBeNull();
    expect(getTenantSlugFromHost(host)).toBeNull();
  });

  it('keeps institution domains distinct from the platform', () => {
    expect(getCustomDomainFromHost('ecole.example')).toBe('ecole.example');
    expect(getCustomDomainFromHost('another-school.vercel.app')).toBe('another-school.vercel.app');
    expect(getTenantSlugFromHost('mon-ecole.rectorplus.com')).toBe('mon-ecole');
    expect(getCustomDomainFromHost('rectorplus.vercel.app.evil.example')).toBe('rectorplus.vercel.app.evil.example');
  });
});
