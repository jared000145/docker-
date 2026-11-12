-- Teacher assignments, publication and student acknowledgement are enforced by SQL.
create function private.teaches_subject(_subject uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.subjects s where s.id=_subject and s.institution_id=private.institution_id() and s.professor_user_id=auth.uid())
$$;
create function private.teacher_student(_student uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles p join public.subjects s on s.institution_id=p.institution_id and s.professor_user_id=auth.uid() where p.user_id=_student and p.institution_id=private.institution_id()
 and ((s.filiere_id=p.filiere_id and (s.level=p.level or p.level=any(s.levels))) or exists(select 1 from public.enrollments e where e.subject_id=s.id and e.user_id=p.user_id)) and (s.campus_id is null or s.campus_id=p.campus_id))
$$;
revoke all on function private.teaches_subject(uuid),private.teacher_student(uuid) from public;
grant execute on function private.teaches_subject(uuid),private.teacher_student(uuid) to authenticated;
create policy teacher_student_read on public.profiles for select to authenticated using(private.teacher_student(user_id));
create policy teacher_grades on public.grades for all to authenticated using(institution_id=private.institution_id() and private.teaches_subject(subject_id) and private.teacher_student(user_id)) with check(institution_id=private.institution_id() and private.teaches_subject(subject_id) and private.teacher_student(user_id));
create policy student_acknowledge on public.grades for update to authenticated using(user_id=auth.uid() and submission_status='pending_approval') with check(user_id=auth.uid() and submission_status='pending_approval');
create policy published_grades on public.grades as restrictive for select to authenticated using(
 private.is_admin() or private.can_module('notes') or private.teaches_subject(subject_id) or private.director_student(user_id,'director_dashboard') or private.director_student(user_id,'director_reports')
 or submission_status in('','submitted') or (user_id=auth.uid() and submission_status='pending_approval'));
create function private.guard_grade_changes() returns trigger language plpgsql security definer set search_path='' as $$
declare allowed text[]; actor_signature text;
begin
 if auth.uid() is null or private.is_super() then return new;end if;
 if tg_op='UPDATE' and old.is_locked and (to_jsonb(new)-array['is_locked','updated_at','updated_by','campus_id']) is distinct from (to_jsonb(old)-array['is_locked','updated_at','updated_by','campus_id']) then raise exception 'Notes verrouillées : rouvrir le dossier avant correction.';end if;
 if private.is_admin() or private.can_module('notes') then return new;end if;
 if new.user_id=auth.uid() and not private.teaches_subject(new.subject_id) then
  allowed:=array['approved_by_student','approved_at','student_signature_url','updated_at'];
  if tg_op<>'UPDATE' or old.submission_status<>'pending_approval' or (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) or not new.approved_by_student then raise insufficient_privilege;end if;
  select signature_url into actor_signature from public.profiles where user_id=auth.uid();
  if actor_signature is null or new.student_signature_url is distinct from actor_signature then raise exception 'Votre signature de profil est requise.';end if;
  new.approved_at:=now()::text;return new;
 end if;
 if not private.teaches_subject(new.subject_id) then raise insufficient_privilege;end if;
 if new.is_locked or new.submission_status not in('draft','pending_approval','submitted') then raise insufficient_privilege;end if;
 if tg_op='UPDATE' then
  if new.subject_id<>old.subject_id or new.user_id<>old.user_id or new.institution_id<>old.institution_id then raise insufficient_privilege;end if;
  if old.submission_status='submitted' then raise exception 'Notes transmises : correction à demander à l’administration.';end if;
  if row(new.cc_grade,new.exam_grade,new.average) is distinct from row(old.cc_grade,old.exam_grade,old.average) then new.approved_by_student:=false;new.approved_at:=null;new.student_signature_url:=null;
  elsif new.approved_by_student is distinct from old.approved_by_student or new.student_signature_url is distinct from old.student_signature_url then raise insufficient_privilege;end if;
 else new.approved_by_student:=false;new.approved_at:=null;new.student_signature_url:=null;
 end if;return new;
end $$;
create trigger guard_grade_changes before insert or update on public.grades for each row execute function private.guard_grade_changes();
