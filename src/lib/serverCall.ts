import { supabase } from '@/integrations/supabase/client';
export class ServerCallError extends Error {
  constructor(message: string, public details: Record<string, unknown> | null = null) { super(message); }
}

export async function invokeServer<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let message = error.message;
    let payload: Record<string, unknown> | null = null;
    const context = 'context' in error ? error.context : null;
    if (context instanceof Response) {
      const details: unknown = await context.clone().json().catch(() => null);
      if (details && typeof details === 'object' && !Array.isArray(details)) payload = details as Record<string, unknown>;
      if (details && typeof details === 'object' && 'error' in details && typeof details.error === 'string') message = details.error;
    }
    throw new ServerCallError(message, payload);
  }
  if (data && typeof data === 'object' && typeof data.error === 'string') throw new Error(data.error);
  return data as T;
}
