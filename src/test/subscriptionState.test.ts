import { describe,expect,it } from 'vitest';
import { subscriptionState } from '@/lib/subscriptionState';
const now=new Date('2026-11-08T12:00:00Z');
const active={status:'active',starts_at:'2026-11-01',ends_at:'2026-12-01'};
describe('subscription access',()=>{
  it('accepts an active subscription or trial',()=>{
    expect(subscriptionState(active,true,now).isExpired).toBe(false);
    expect(subscriptionState({...active,status:'trialing'},true,now).isExpired).toBe(false);
  });
  it.each(['blocked','cancelled','expired','unknown'])('blocks status %s',status=>expect(subscriptionState({...active,status},true,now).isExpired).toBe(true));
  it('blocks expired, future, missing and malformed subscriptions',()=>{
    expect(subscriptionState({...active,ends_at:'2026-11-08'},true,now).isExpired).toBe(true);
    expect(subscriptionState({...active,starts_at:'2026-11-09'},true,now).isExpired).toBe(true);
    expect(subscriptionState(undefined,true,now).isExpired).toBe(true);
    expect(subscriptionState({...active,ends_at:'invalid'},true,now).isExpired).toBe(true);
    expect(subscriptionState(active,false,now).isExpired).toBe(true);
  });
});
