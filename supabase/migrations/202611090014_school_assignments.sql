-- Canonical keys used by upserts and identity-based class assignments.
create unique index grades_trimestre_student_period on public.grades_trimestre(user_id,classe_id,matiere,trimestre,academic_year);
create unique index profiles_auth_identity on public.profiles(user_id);
create function private.resolve_class_professor() returns trigger language plpgsql security definer set search_path='' as $$
declare teacher uuid;
begin
 if not exists(select 1 from public.classes where id=new.classe_id and institution_id=new.institution_id) or not exists(select 1 from public.subjects where id=new.subject_id and institution_id=new.institution_id) then raise exception 'Classe ou matière étrangère.';end if;
 if new.professor_user_id is null and nullif(trim(new.professor_name),'') is not null then
  select min(p.user_id::text)::uuid into teacher from public.profiles p join public.user_roles r on r.user_id=p.user_id and r.role='professor' where p.institution_id=new.institution_id and lower(trim(p.first_name||' '||p.last_name))=lower(trim(new.professor_name)) having count(*)=1;
  new.professor_user_id:=teacher;
 end if;
 if new.professor_user_id is null then select professor_user_id into new.professor_user_id from public.subjects where id=new.subject_id;end if;
 if new.professor_user_id is not null and not exists(select 1 from public.profiles p join public.user_roles r on r.user_id=p.user_id and r.role='professor' where p.user_id=new.professor_user_id and p.institution_id=new.institution_id) then raise exception 'Enseignant étranger.';end if;
 return new;
end $$;
create trigger resolve_class_professor before insert or update on public.subject_classes for each row execute function private.resolve_class_professor();
update public.subject_classes set professor_name=professor_name;
create function private.teaches_class_subject(_class uuid,_subject text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subject_classes sc join public.subjects s on s.id=sc.subject_id where sc.classe_id=_class and sc.institution_id=private.institution_id() and sc.professor_user_id=auth.uid() and lower(s.name)=lower(_subject))
$$;
revoke all on function private.teaches_class_subject(uuid,text) from public;
grant execute on function private.teaches_class_subject(uuid,text) to authenticated;
create policy teacher_class_profiles on public.profiles for select to authenticated using(institution_id=private.institution_id() and exists(select 1 from public.subject_classes sc where sc.classe_id=profiles.classe_id and sc.professor_user_id=auth.uid()));
create policy teacher_class_assignments on public.subject_classes for select to authenticated using(institution_id=private.institution_id() and professor_user_id=auth.uid());
create policy teacher_trimester_grades on public.grades_trimestre for all to authenticated using(institution_id=private.institution_id() and private.teaches_class_subject(classe_id,matiere)) with check(institution_id=private.institution_id() and private.teaches_class_subject(classe_id,matiere) and professor_user_id=auth.uid());
create function private.profile_references() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.filiere_id is not null and not exists(select 1 from public.filieres where id=new.filiere_id and institution_id=new.institution_id) then raise exception 'Filière étrangère.';end if;
 if new.classe_id is not null and not exists(select 1 from public.classes where id=new.classe_id and institution_id=new.institution_id) then raise exception 'Classe étrangère.';end if;
 if new.campus_id is not null and not exists(select 1 from public.campuses where id=new.campus_id and institution_id=new.institution_id) then raise exception 'Campus étranger.';end if;
 if auth.uid() is not null and private.restricted_staff() and new.campus_id is distinct from old.campus_id and not private.staff_campus(new.campus_id) then raise insufficient_privilege;end if;
 return new;
end $$;
create trigger profile_references before update on public.profiles for each row execute function private.profile_references();
