create function public.admin_global_search(_query text,_campus uuid default null) returns table(user_id uuid,first_name text,last_name text,avatar_url text,student_number text,email text,phone text,level text,filiere_id uuid,kind text) language sql stable security definer set search_path='' as $$
 select p.user_id,p.first_name,p.last_name,p.avatar_url,p.student_number,p.email,p.phone,p.level,p.filiere_id,case when r.role='user' then 'student' else 'professor' end
 from public.profiles p join public.user_roles r on r.user_id=p.user_id where p.institution_id=private.institution_id() and private.staff_person_scope(p.user_id)
 and (_campus is null or p.campus_id=_campus) and length(trim(_query))>=2
 and (r.role='user' and (private.can_module('etudiants') or private.can_module('director_dashboard') or private.can_module('director_reports')) or r.role='professor' and private.can_module('profs'))
 and p.first_name||' '||p.last_name||' '||coalesce(p.student_number,'') ilike '%'||left(trim(_query),100)||'%' order by p.last_name,p.first_name limit 30
$$;
revoke all on function public.admin_global_search(text,uuid) from public;grant execute on function public.admin_global_search(text,uuid) to authenticated;
alter table public.student_years alter constraint student_years_previous_year_id_fkey deferrable initially deferred;
create index on public.student_years(institution_id,academic_year,campus_id);
create index on public.campus_expenses(institution_id,academic_year,campus_id);
create index on public.applications(target_institution_id,campus_id,status);
create index on public.admission_files(user_id,kind,created_at desc);
