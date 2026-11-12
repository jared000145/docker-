import { act,renderHook,cleanup } from '@testing-library/react';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { afterEach,describe,expect,it,vi } from 'vitest';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
const state=vi.hoisted(()=>({user:null as null|{id:string},change:null as null|(()=>void),status:null as null|((value:string)=>void),channel:vi.fn(),remove:vi.fn()}));
vi.mock('@/hooks/useAuth',()=>({useAuth:()=>({user:state.user})}));
vi.mock('@/integrations/supabase/client',()=>({supabase:{channel:state.channel,removeChannel:state.remove}}));
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();state.user=null;});
describe('realtime session lifecycle',()=>{
  it('subscribes after login, invalidates current keys and removes the channel on logout',()=>{
    vi.useFakeTimers();
    const channel={on:vi.fn((_event,_config,callback)=>{state.change=callback;return channel;}),subscribe:vi.fn(callback=>{state.status=callback;return channel;})};
    state.channel.mockReturnValue(channel);
    const client=new QueryClient();const invalidate=vi.spyOn(client,'invalidateQueries');
    const wrapper=({children}:{children:React.ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
    const {rerender}=renderHook(({keys})=>useRealtimeSubscription('institutions',keys),{wrapper,initialProps:{keys:[['initial']]}});
    expect(state.channel).not.toHaveBeenCalled();
    state.user={id:'user-a'};rerender({keys:[['initial']]});
    expect(state.channel).toHaveBeenCalledTimes(1);
    act(()=>state.status?.('SUBSCRIBED'));
    expect(invalidate).toHaveBeenCalledWith({queryKey:['initial']});
    rerender({keys:[['latest']]});
    act(()=>{state.change?.();vi.advanceTimersByTime(500);});
    expect(invalidate).toHaveBeenCalledWith({queryKey:['latest']});
    expect(state.channel).toHaveBeenCalledTimes(1);
    state.user=null;rerender({keys:[['latest']]});
    expect(state.remove).toHaveBeenCalledWith(channel);
  });
});
