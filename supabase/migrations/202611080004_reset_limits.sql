create table private.reset_limits (key text primary key, requested_at timestamptz not null);
create function public.consume_reset_attempt(_key text) returns boolean language plpgsql security definer set search_path = '' as $$
declare accepted boolean;
begin
  insert into private.reset_limits(key,requested_at) values (_key,now())
  on conflict (key) do update set requested_at=now() where private.reset_limits.requested_at < now()-interval '60 seconds'
  returning true into accepted;
  return coalesce(accepted,false);
end $$;
revoke all on function public.consume_reset_attempt(text) from public,anon,authenticated;
grant execute on function public.consume_reset_attempt(text) to service_role;
