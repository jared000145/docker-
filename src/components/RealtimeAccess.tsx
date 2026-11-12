import { useAuth } from '@/hooks/useAuth';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
export default function RealtimeAccess() {
  const { user }=useAuth();
  const filter=user?{column:'user_id',value:user.id}:undefined;
  useRealtimeSubscription('user_roles',[['user-role'],['user-role-super'],['user-role-professor'],['is-parent'],['user-permission-keys']],filter);
  useRealtimeSubscription('team_members',[['team-permissions'],['director-flag']],filter);
  return null;
}
