import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { subscriptionState } from '@/lib/subscriptionState';
import { useEffect, useState } from 'react';

/**
 * Returns the current user's institution subscription with derived state:
 * - daysLeft (negative when expired)
 * - isExpired
 * - isWarning (<=7 days)
 * - isCritical (<=1 day)
 */
export const useSubscription = () => {
  const { user, profile } = useAuth();
  const institutionId = profile?.institution_id;
  const [now,setNow] = useState(()=>new Date());
  useEffect(()=>{ const timer=window.setInterval(()=>setNow(new Date()),60_000); return ()=>window.clearInterval(timer); },[]);
  useRealtimeSubscription('institution_subscriptions', [['my-institution-subscription',institutionId || '']], institutionId ? {column:'institution_id',value:institutionId} : undefined);
  useRealtimeSubscription('institutions', [['my-institution-active',institutionId || '']], institutionId ? {column:'id',value:institutionId} : undefined);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ["my-institution-subscription", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      const { data, error } = await (supabase as any)
        .from("institution_subscriptions")
        .select("*")
        .eq("institution_id", institutionId)
        .maybeSingle();
      if(error) throw error;
      return data;
    },
    enabled: !!user && !!institutionId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: institution, isLoading: institutionLoading } = useQuery({
    queryKey: ["my-institution-active", institutionId],
    queryFn: async () => {
      if (!institutionId) return null;
      const { data, error } = await (supabase as any)
        .from("institutions")
        .select("id, is_active, name")
        .eq("id", institutionId)
        .maybeSingle();
      if(error) throw error;
      return data;
    },
    enabled: !!user && !!institutionId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { daysLeft, isExpired, isCritical, isWarning } = subscriptionState(subscription,institution?.is_active !== false,now);

  return {
    subscription,
    institution,
    daysLeft,
    isExpired,
    isWarning,
    isCritical,
    isLoading: isLoading || institutionLoading,
  };
};
