-- Public campus photographs; student profile pictures remain private.
alter table public.campuses add column photo_path text;
alter table public.events add column campus_id uuid references public.campuses(id);
create policy event_campus_boundary on public.events as restrictive for all to authenticated
 using(private.is_super() or campus_id is null or private.staff_campus(campus_id))
 with check(private.is_super() or campus_id is null or private.staff_campus(campus_id) and exists(select 1 from public.campuses c where c.id=events.campus_id and c.institution_id=events.institution_id));
create function public.set_campus_photo(_campus uuid,_path text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.campuses where id=_campus and institution_id=private.institution_id()) or not private.is_admin() then raise insufficient_privilege;end if;
 if _path is not null and (not starts_with(_path,auth.uid()::text||'/campus-'||_campus::text||'-') or _path !~ '\.(jpg|jpeg|png|webp)$' or not exists(select 1 from storage.objects where bucket_id='avatars' and name=_path)) then raise exception 'Photographie invalide';end if;
 update public.campuses set photo_path=_path,updated_at=now() where id=_campus;
end $$;
revoke all on function public.set_campus_photo(uuid,text) from public;
grant execute on function public.set_campus_photo(uuid,text) to authenticated;
-- Aggregate only the actor's institution, academic scope and permitted campuses.
create function public.director_dashboard(_year text, _campus uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb; tenant uuid:=private.institution_id(); finance boolean;
begin
 if tenant is null or not private.can_module('director_dashboard') or not private.subscription_active(tenant) then raise insufficient_privilege; end if;
 if _year !~ '^\d{4}-\d{4}$' then raise exception 'Année invalide'; end if;
 if _campus is not null and not exists(select 1 from public.campuses where id=_campus and institution_id=tenant and private.staff_campus(id)) then raise insufficient_privilege; end if;
 finance:=(private.can_module('paiements') or private.can_module('director_finance')) and not exists(select 1 from public.team_members where user_id=auth.uid() and coalesce(academic_scope,'all')<>'all');
 with pupils as (
 select y.user_id,y.campus_id,y.created_at from public.student_years y
 where y.institution_id=tenant and y.academic_year=_year and y.enrollment_status='active'
 and private.staff_campus(y.campus_id)
 and not exists(select 1 from public.team_members t where t.user_id=auth.uid() and coalesce(t.academic_scope,'all')<>'all' and not(case t.academic_scope when 'licence' then y.niveau in('L1','L2','L3') when 'master' then y.niveau in('M1','M2') when 'college' then y.niveau in('6e','5e','4e','3e') when 'lycee' then y.niveau in('2nde','1ère','Terminale') else false end))
 and (_campus is null or y.campus_id=_campus)
 and exists(select 1 from public.user_roles r where r.user_id=y.user_id and r.role='user')
 ), marks as (
 select g.user_id,g.average::numeric as score from public.grades g join pupils p on p.user_id=g.user_id
 where g.institution_id=tenant and g.academic_year=_year and g.average is not null and private.staff_campus(g.campus_id)
 union all
 select g.user_id, (coalesce(g.note1/nullif(g.bareme1,0),0)+coalesce(g.note2/nullif(g.bareme2,0),0)+coalesce(g.note3/nullif(g.bareme3,0),0))*20/nullif((g.note1 is not null)::int+(g.note2 is not null)::int+(g.note3 is not null)::int,0)
 from public.grades_trimestre g join pupils p on p.user_id=g.user_id where g.institution_id=tenant and g.academic_year=_year
 ), averages as (select user_id,avg(score) score from marks where score is not null group by user_id),
 sites as (select c.id,c.name,c.city,c.photo_path from public.campuses c where c.institution_id=tenant and c.is_active and private.staff_campus(c.id) and (_campus is null or c.id=_campus)),
 money as (select p.* from public.payments p where finance and p.institution_id=tenant and p.academic_year=_year and private.staff_campus(p.campus_id) and (_campus is null or p.campus_id=_campus)),
 months as (select generate_series(0,5) i),
 dates as (select (least(current_date,make_date(split_part(_year,'-',2)::int,8,31))-interval '1 month'*i)::date d from months)
 select jsonb_build_object(
 'students',(select count(*) from pupils),
 'assessed',(select count(*) from averages),
 'success',(select round(100.0*count(*) filter(where score>=10)/nullif(count(*),0),1) from averages),
 'received',case when finance then (select coalesce(sum(paid_amount),0) from money) end,
 'unpaid',case when finance then (select coalesce(sum(greatest(amount-paid_amount,0)),0) from money) end,
 'sites',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'city',s.city,'photo_path',s.photo_path,'students',(select count(*) from pupils p where p.campus_id=s.id),'success',(select round(100.0*count(*) filter(where a.score>=10)/nullif(count(*),0),1) from averages a join pupils p on p.user_id=a.user_id where p.campus_id=s.id)) order by s.name) from sites s),'[]'),
 'unassigned',(select count(*) from pupils where campus_id is null),
 'evolution',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(d,'YYYY-MM'),'students',(select count(*) from pupils where created_at<date_trunc('month',d)+interval '1 month')) order by d) from dates),'[]'),
 'pending',case when private.can_module('director_documents') then (select count(*) from public.document_validations v where v.institution_id=tenant and v.academic_year=_year and v.status='pending' and (v.student_user_id is null and _campus is null and private.all_campuses() or exists(select 1 from pupils p where p.user_id=v.student_user_id))) end
 ) into result;
 return result;
end $$;
revoke all on function public.director_dashboard(text,uuid) from public;
grant execute on function public.director_dashboard(text,uuid) to authenticated;
