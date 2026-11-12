import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/authRouting';
describe('login return paths', () => {
  it('preserves internal paths', () => expect(safeNextPath('/dashboard?tab=notes#latest')).toBe('/dashboard?tab=notes#latest'));
  it.each(['https://evil.test', '//evil.test', '/\\evil.test', '/login', '/parent/login', '/\nevil.test'])('rejects unsafe or looping path %s', path => expect(safeNextPath(path)).toBeNull());
});
