alter table public.notifications add column created_by uuid references auth.users(id) on delete set null;
create function private.notification_sender() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then if auth.uid() is not null then new.created_by:=auth.uid();new.created_at:=now();end if;return new;end if;
 if auth.uid() is not null and not private.is_super() and (to_jsonb(new)-array['is_read','read_at']) is distinct from (to_jsonb(old)-array['is_read','read_at']) then raise insufficient_privilege;end if;
 return new;
end $$;
create trigger notification_sender before insert or update on public.notifications for each row execute function private.notification_sender();
create policy sender_notification_read on public.notifications for select to authenticated using(created_by=auth.uid() and institution_id=private.institution_id() and private.can_module('communaute'));
create function public.notification_history(_year text,_campus uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; start_year integer;
begin
 if not private.can_module('communaute') then raise insufficient_privilege;end if;
 if _year !~ '^\d{4}-\d{4}$' then raise exception 'Année invalide.';end if;start_year:=split_part(_year,'-',1)::integer;
 if split_part(_year,'-',2)::integer<>start_year+1 then raise exception 'Année invalide.';end if;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') into result from(select n.*,p.first_name||' '||p.last_name as recipient_name from public.notifications n join public.profiles p on p.user_id=n.user_id
 where n.created_by=auth.uid() and n.institution_id=private.institution_id() and p.institution_id=n.institution_id and private.staff_person_scope(p.user_id)
 and (_campus is null or p.campus_id=_campus)
 and n.created_at>=(make_date(start_year,9,1)::timestamp at time zone 'UTC')-interval '1 hour'
 and n.created_at<(make_date(start_year+1,9,1)::timestamp at time zone 'UTC')-interval '1 hour'
 order by n.created_at desc limit 200)d;return result;
end $$;
revoke all on function public.notification_history(text,uuid) from public;grant execute on function public.notification_history(text,uuid) to authenticated;
create index on public.notifications(created_by,institution_id,created_at desc);
