create function private.contact_allowed(_person uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p where p.user_id=_person and p.institution_id=private.institution_id() and
 (private.all_campuses() or private.staff_campus(p.campus_id) or exists(select 1 from public.campus_staff s where s.user_id=p.user_id and private.staff_campus(s.campus_id)) or
 exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='admin' and not exists(select 1 from public.team_members t where t.user_id=p.user_id and not t.is_principal))))
$$;
create function public.contact_directory(_search text default '',_campus uuid default null,_person uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(d)),'[]') from(select p.user_id,p.first_name,p.last_name,p.avatar_url,p.student_number,p.department,p.campus_id,p.filiere_id,p.level,
 exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='user') as is_student
 from public.profiles p where p.institution_id=private.institution_id() and p.user_id<>auth.uid() and private.contact_allowed(p.user_id)
 and (_campus is null or p.campus_id=_campus or p.campus_id is null) and (_person is null or p.user_id=_person)
 and (length(trim(_search))=0 or p.first_name||' '||p.last_name||' '||coalesce(p.student_number,'') ilike '%'||left(trim(_search),100)||'%') order by p.last_name,p.first_name limit 100)d
$$;
create policy message_campus_recipient on public.messages as restrictive for insert to authenticated with check(private.is_super() or private.contact_allowed(recipient_id));
revoke all on function private.contact_allowed(uuid),public.contact_directory(text,uuid,uuid) from public;grant execute on function private.contact_allowed(uuid),public.contact_directory(text,uuid,uuid) to authenticated;

-- Future registrations are prepared without changing the pupil's current class.
create function private.prepare_annual_registration() returns trigger language plpgsql security definer set search_path='' as $$
declare current_year text;
begin
 select academic_year into current_year from public.institutions where id=new.institution_id;
 if new.previous_year_id is not null and new.academic_year>current_year then new.enrollment_status:='pending';new.can_access:=false;end if;
 return new;
end $$;
create trigger prepare_annual_registration before insert on public.student_years for each row execute function private.prepare_annual_registration();
-- Defer the profile change attempted by advance_student when the registration is only prepared.
create function private.defer_future_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare y public.student_years;
begin
 if new.academic_year is distinct from old.academic_year then
 select * into y from public.student_years where user_id=new.user_id and institution_id=new.institution_id and academic_year=new.academic_year and enrollment_status='pending' limit 1;
 if y.id is not null then new.academic_year:=old.academic_year;new.level:=old.level;new.campus_id:=old.campus_id;new.classe_id:=old.classe_id;end if;
 end if;return new;
end $$;
create trigger a_defer_future_profile before update on public.profiles for each row execute function private.defer_future_profile();
create function private.activate_academic_registrations() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.academic_year is distinct from old.academic_year then
  update public.student_years set enrollment_status='active',can_access=true,updated_at=now() where institution_id=new.id and academic_year=new.academic_year and enrollment_status='pending';
  update public.profiles p set academic_year=y.academic_year,level=y.niveau,classe_id=y.classe_id,campus_id=y.campus_id,filiere_id=y.filiere_id from public.student_years y where y.user_id=p.user_id and y.institution_id=new.id and y.academic_year=new.academic_year and y.enrollment_status='active';
 end if;return new;
end $$;
create trigger activate_academic_registrations after update of academic_year on public.institutions for each row execute function private.activate_academic_registrations();
