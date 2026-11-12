create function public.submit_trimester_results(_institution uuid,_year text,_trimester text) returns int language plpgsql security definer set search_path='' as $$
declare c public.classes; rows jsonb; results jsonb; students jsonb; total int:=0;
begin
 if not private.is_super() and not(_institution=private.institution_id() and private.can_module('cloture')) then raise insufficient_privilege;end if;
 if _trimester not in('T1','T2','T3') or _year is distinct from(select academic_year from public.institutions where id=_institution) then raise exception 'Période invalide.';end if;
 lock table public.grades_trimestre in share row exclusive mode;
 perform 1 from public.institutions where id=_institution for update;
 if exists(select 1 from public.trimestre_closures where institution_id=_institution and academic_year=_year and trimestre=_trimester) then raise exception 'Trimestre déjà transmis.';end if;
 for c in select * from public.classes where institution_id=_institution and academic_year=_year order by id loop
  select coalesce(jsonb_agg(jsonb_build_object('user_id',p.user_id,'first_name',p.first_name,'last_name',p.last_name,'student_number',p.student_number,'level',p.level,'campus_id',p.campus_id,'date_of_birth',p.date_of_birth)),'[]') into students
   from public.profiles p where p.institution_id=_institution and p.classe_id=c.id and exists(select 1 from public.user_roles r where r.user_id=p.user_id and r.role='user');
  if jsonb_array_length(students)=0 then continue;end if;
  select coalesce(jsonb_agg(to_jsonb(g)),'[]') into rows from public.grades_trimestre g where g.institution_id=_institution and g.classe_id=c.id and g.academic_year=_year and g.trimestre=_trimester;
  if exists(select 1 from jsonb_array_elements(students) p where not exists(select 1 from jsonb_array_elements(rows) g where g->>'user_id'=p->>'user_id'))
   or exists(select 1 from jsonb_array_elements(rows) g where (g->>'note1' is null and g->>'note2' is null and g->>'note3' is null) or coalesce((g->>'coefficient')::numeric,0)<=0
    or (g->>'note1' is not null and ((g->>'bareme1')::numeric<=0 or (g->>'note1')::numeric<0 or (g->>'note1')::numeric>(g->>'bareme1')::numeric))
    or (g->>'note2' is not null and ((g->>'bareme2')::numeric<=0 or (g->>'note2')::numeric<0 or (g->>'note2')::numeric>(g->>'bareme2')::numeric))
    or (g->>'note3' is not null and ((g->>'bareme3')::numeric<=0 or (g->>'note3')::numeric<0 or (g->>'note3')::numeric>(g->>'bareme3')::numeric))) then raise exception 'Notes manquantes ou invalides pour la classe %.',c.nom;end if;
  if exists(select 1 from jsonb_array_elements(students) p cross join public.subject_classes sc join public.subjects su on su.id=sc.subject_id where sc.classe_id=c.id and not exists(select 1 from jsonb_array_elements(rows) g where g->>'user_id'=p->>'user_id' and lower(g->>'matiere')=lower(su.name))) then raise exception 'Matières non évaluées pour la classe %.',c.nom;end if;
  select jsonb_agg(p||jsonb_build_object('grade_lines',(select jsonb_agg(g) from jsonb_array_elements(rows) g where g->>'user_id'=p->>'user_id'))) into results from jsonb_array_elements(students) p;
  insert into public.document_validations(institution_id,document_type,academic_year,title,status,payload,created_by)
   values(_institution,'bulletin',_year,'Bulletins '||_trimester||' — '||c.nom,'pending',jsonb_build_object('kind','class_bulletins_trimestre','academicYear',_year,'trimestre',_trimester,'classe',to_jsonb(c),'results',results,'eleves',results,'class_all_grades',rows,'snapshot_at',now()),auth.uid()::text);
  total:=total+1;
 end loop;
 if total=0 then raise exception 'Aucune classe avec des élèves inscrits.';end if;
 insert into public.trimestre_closures(institution_id,academic_year,trimestre,closed_by,closed_at) values(_institution,_year,_trimester,auth.uid()::text,now()::text);
 return total;
end $$;
revoke all on function public.submit_trimester_results(uuid,text,text) from public;
grant execute on function public.submit_trimester_results(uuid,text,text) to authenticated;
create function private.guard_trimester_grade() returns trigger language plpgsql security definer set search_path='' as $$
declare r jsonb:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
 if auth.uid() is not null and not private.is_super() and exists(select 1 from public.trimestre_closures c where c.institution_id=(r->>'institution_id')::uuid and c.academic_year=r->>'academic_year' and c.trimestre=r->>'trimestre') then raise exception 'Trimestre verrouillé : rouvrir les résultats avant correction.';end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger guard_trimester_grade before insert or update or delete on public.grades_trimestre for each row execute function private.guard_trimester_grade();
