create function public.broadcast_recipients(_campus uuid default null) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.can_module('communaute') then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') into result from(select p.user_id,p.first_name,p.last_name,p.avatar_url,p.student_number,p.filiere_id,p.level,p.campus_id
 from public.profiles p where p.institution_id=private.institution_id() and private.staff_person_scope(p.user_id) and (_campus is null or p.campus_id=_campus)
 and exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='user')
 and exists(select 1 from public.student_years y join public.institutions i on i.id=y.institution_id where y.user_id=p.user_id and y.institution_id=p.institution_id and y.academic_year=i.academic_year and y.enrollment_status='active')
 order by p.last_name,p.first_name limit 5001)d;
 if jsonb_array_length(result)>5000 then raise exception 'Sélectionnez un campus plus restreint : 5 000 destinataires maximum par diffusion.';end if;return result;
end $$;
revoke all on function public.broadcast_recipients(uuid) from public;grant execute on function public.broadcast_recipients(uuid) to authenticated;
