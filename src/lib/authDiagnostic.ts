const key = 'rp_auth_status';
export function recordAuthStatus(message: string) {
  try { sessionStorage.setItem(key, message); window.dispatchEvent(new Event('rp-auth-status')); } catch { /* Storage may be unavailable. */ }
}
export function readAuthStatus() {
  try { return sessionStorage.getItem(key) || ''; } catch { return ''; }
}
