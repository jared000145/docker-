const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const configurationErrors: string[] = [];
try {
  const parsed = new URL(url || '');
  if (!['https:', 'http:'].includes(parsed.protocol) || parsed.hostname === 'your-project.supabase.co') throw new Error();
} catch { configurationErrors.push('VITE_SUPABASE_URL'); }
if (!key || key === 'your-supabase-publishable-key') configurationErrors.push('VITE_SUPABASE_PUBLISHABLE_KEY');
export const isConfigured = configurationErrors.length === 0;
export const backendUrl = isConfigured ? url! : 'https://configuration-required.invalid';
export const backendKey = isConfigured ? key! : 'configuration-required';
