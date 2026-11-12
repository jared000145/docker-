export function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\s]/.test(value) || Array.from(value).some(character => character.charCodeAt(0) < 32)) return null;
  const url = new URL(value, 'https://rectorplus.invalid');
  if (url.origin !== 'https://rectorplus.invalid' || ['/login', '/parent/login'].includes(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}
