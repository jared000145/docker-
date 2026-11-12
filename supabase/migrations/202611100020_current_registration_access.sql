-- A prepared next-year registration must never override current-year access.
create or replace function public.get_student_access(_user_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare y public.student_years; active boolean; current_year text;
begin
 if not private.can_read_student(_user_id) and not (private.is_admin() and exists(select 1 from public.profiles where user_id=_user_id and institution_id=private.institution_id())) then raise insufficient_privilege;end if;
 select i.is_active and private.subscription_active(i.id),i.academic_year into active,current_year from public.profiles p join public.institutions i on i.id=p.institution_id where p.user_id=_user_id;
 select * into y from public.student_years where user_id=_user_id and academic_year=current_year;
 return jsonb_build_object('allowed',coalesce(active,false) and coalesce(y.can_access,true),'status',coalesce(y.status,'active'),'reason',y.block_reason,'restricted',case when coalesce(active,false) and coalesce(y.can_access,true) then '[]'::jsonb else '["all"]'::jsonb end);
end $$;
create or replace function public.has_new_year_access(_user_id uuid,_academic_year text default null) returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select y.can_access from public.student_years y join public.institutions i on i.id=y.institution_id where y.user_id=_user_id and y.academic_year=coalesce(_academic_year,i.academic_year)),true);
$$;
