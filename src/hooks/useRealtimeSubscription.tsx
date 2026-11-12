import { useEffect, useRef, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type TableName = "institutions" | "institution_subscriptions" | "institution_preregistrations" | "team_members" | "user_roles" | "messages" | "notifications" | "grades" | "payments" | "schedule_events" | "subjects" | "profiles" | "enrollments" | "filieres" | "semester_progress" | "events" | "event_comments" | "event_likes" | "soutenances" | "soutenance_jury" | "bde_posts" | "bde_members" | "elections" | "election_candidates" | "election_votes" | "community_posts" | "community_comments" | "community_likes" | "community_reactions" | "community_bookmarks" | "community_comment_likes" | "video_conferences" | "stories" | "story_replies" | "document_validations" | "user_roles_v2" | "role_permissions" | "roles";

/**
 * Subscribe to realtime changes on a Supabase table and auto-invalidate queries.
 * Uses debounced invalidation to prevent rapid page re-renders.
 */
export function useRealtimeSubscription(
  table: TableName | 'attendance' | 'audit_logs' | 'student_years' | 'applications' | 'campus_expenses',
  queryKeys: string[][],
  filter?: { column: string; value: string }
) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const queryKeysRef = useRef(queryKeys);
  queryKeysRef.current = queryKeys;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uniqueId = useId();

  useEffect(() => {
    const channelConfig: any = {
      event: "*",
      schema: "public",
      table,
    };

    if (filter) {
      channelConfig.filter = `${filter.column}=eq.${filter.value}`;
    }

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    if (user?.id) {
      const channelName = filter
        ? `${table}-${filter.column}-${filter.value}-${user.id}-${uniqueId}`
        : `${table}-all-${user.id}-${uniqueId}`;

      channel = supabase.channel(channelName).on("postgres_changes", channelConfig, () => {
        // Debounce invalidation to prevent rapid re-renders
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (isMounted) queryKeysRef.current.forEach((key) => qc.invalidateQueries({ queryKey: key }));
        }, 500);
      })
      .subscribe(status => {
        if (status === 'SUBSCRIBED' && isMounted) queryKeysRef.current.forEach(key => qc.invalidateQueries({ queryKey:key }));
      });
    }

    return () => {
      isMounted = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [table, filter?.column, filter?.value, qc, user?.id, uniqueId]);
}
