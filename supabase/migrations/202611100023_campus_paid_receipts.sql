-- Include historical receipts marked paid even when no paid_amount was stored.
-- Freeze the annual financial scope as well as the visible campus.
create or replace function public.campus_overview(_year text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; finance boolean:=(private.can_module('paiements') or private.can_module('director_finance')) and not exists(select 1 from public.team_members where user_id=auth.uid() and coalesce(academic_scope,'all')<>'all');
begin
 if not(private.can_module('etudiants') or private.can_module('director_dashboard') or finance) then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'students',(select count(distinct p.user_id) from public.profiles p join public.student_years y on y.user_id=p.user_id and y.institution_id=p.institution_id where p.institution_id=c.institution_id and y.campus_id=c.id and y.academic_year=_year and y.enrollment_status='active' and private.staff_person_scope(p.user_id)),
 'received',case when finance then (select coalesce(sum(case when status='paid' and coalesce(paid_amount,0)=0 then amount else coalesce(paid_amount,0) end),0) from public.payments where institution_id=c.institution_id and campus_id=c.id and academic_year=_year) else null end,
 'expenses',case when finance then (select coalesce(sum(amount),0) from public.campus_expenses where institution_id=c.institution_id and campus_id=c.id and academic_year=_year) else null end) order by c.name),'[]') into result
 from public.campuses c where c.institution_id=private.institution_id() and c.is_active and private.staff_campus(c.id);
 return result;
end $$;
