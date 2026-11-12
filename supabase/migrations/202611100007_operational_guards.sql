-- Freeze the annual financial scope as well as the visible campus.
create or replace function public.campus_overview(_year text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; finance boolean:=(private.can_module('paiements') or private.can_module('director_finance')) and not exists(select 1 from public.team_members where user_id=auth.uid() and coalesce(academic_scope,'all')<>'all');
begin
 if not(private.can_module('etudiants') or private.can_module('director_dashboard') or finance) then raise insufficient_privilege;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'students',(select count(distinct p.user_id) from public.profiles p join public.student_years y on y.user_id=p.user_id and y.institution_id=p.institution_id where p.institution_id=c.institution_id and y.campus_id=c.id and y.academic_year=_year and y.enrollment_status='active' and private.staff_person_scope(p.user_id)),
 'received',case when finance then (select coalesce(sum(paid_amount),0) from public.payments where institution_id=c.institution_id and campus_id=c.id and academic_year=_year) else null end,
 'expenses',case when finance then (select coalesce(sum(amount),0) from public.campus_expenses where institution_id=c.institution_id and campus_id=c.id and academic_year=_year) else null end) order by c.name),'[]') into result
 from public.campuses c where c.institution_id=private.institution_id() and c.is_active and private.staff_campus(c.id);
 return result;
end $$;
create function private.validate_annual_target() returns trigger language plpgsql security definer set search_path='' as $$
declare active text;
begin
 select academic_year into active from public.institutions where id=new.institution_id;
 if new.previous_year_id is not null and active ~ '^\d{4}-\d{4}$' and split_part(new.academic_year,'-',1)::int>split_part(active,'-',1)::int+1 then raise exception 'Préparez uniquement l’année suivante.';end if;
 if new.previous_year_id is not null and exists(select 1 from public.campuses where institution_id=new.institution_id and is_active) and new.campus_id is null then raise exception 'Choisissez le campus de la nouvelle inscription.';end if;
 return new;
end $$;
create trigger validate_annual_target before insert on public.student_years for each row execute function private.validate_annual_target();
create policy admission_unattached_cleanup on storage.objects for delete to authenticated using(bucket_id='admission-files' and private.path_owner(name)=auth.uid() and not exists(select 1 from public.admission_files f where f.path=name and f.bucket=bucket_id));
do $$declare t text;begin
 foreach t in array array['applications','application_messages','student_years','campus_expenses','campus_staff','campus_access_grants','admission_funding','admission_files','bac_results'] loop
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then execute format('alter publication supabase_realtime add table public.%I',t);end if;
 end loop;
end $$;
