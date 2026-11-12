import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const auth = vi.hoisted(() => ({ listener: null as null | ((event: string, session: { user: { id: string } } | null) => void) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    channel: () => { const channel={on:()=>channel,subscribe:()=>channel}; return channel; },
    removeChannel: vi.fn(),
    auth: {
      onAuthStateChange: (listener: typeof auth.listener) => { auth.listener = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from: () => ({ select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: async () => ({ data: { user_id:id,first_name: id }, error: null }) }) }) ,update:()=>({eq:async()=>({error:null})})}),
  },
}));

function Status() {
  const { user, profile, loading } = useAuth();
  return <div>{loading ? 'loading' : `${user?.id || 'anonymous'}:${profile?.first_name || ''}`}</div>;
}
function PhotoStatus(){const {profile,updateAvatar}=useAuth();return <><p>{profile?.avatar_url||'no-photo'}</p><button onClick={()=>void updateAvatar('profile-photos:new-photo')}>Save photo</button></>;}
afterEach(cleanup);

describe('account transitions', () => {
  it('updates the visible profile without relying on a Realtime event',async()=>{
    render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Status /><PhotoStatus /></AuthProvider></QueryClientProvider>);
    await screen.findByText('anonymous:');
    act(()=>auth.listener?.('SIGNED_IN',{user:{id:'account-a'}}));
    await screen.findByText('account-a:account-a');
    fireEvent.click(screen.getByRole('button',{name:'Save photo'}));
    await screen.findByText('profile-photos:new-photo');
  });
  it('removes the previous account cache and profile when switching accounts and signing out', async () => {
    const client = new QueryClient();
    render(<QueryClientProvider client={client}><AuthProvider><Status /></AuthProvider></QueryClientProvider>);
    await screen.findByText('anonymous:');
    act(() => auth.listener?.('SIGNED_IN', { user: { id: 'account-a' } }));
    await screen.findByText('account-a:account-a');
    client.setQueryData(['private-payment'], { amount: 500 });
    act(() => auth.listener?.('SIGNED_IN', { user: { id: 'account-b' } }));
    await screen.findByText('account-b:account-b');
    expect(client.getQueryData(['private-payment'])).toBeUndefined();
    act(() => auth.listener?.('SIGNED_OUT', null));
    await waitFor(() => expect(screen.getByText('anonymous:')).toBeInTheDocument());
  });
});
