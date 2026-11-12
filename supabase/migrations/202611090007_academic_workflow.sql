-- Server-owned result snapshots and explicit sequential validation.
create function public.academic_results(_institution uuid,_year text) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare p record; s record; g record; b record; param public.parametres_etablissement; inst public.institutions;
 lines jsonb; groups jsonb; result jsonb:='[]'; student_year public.student_years; level text; programme uuid;
 note numeric; final_note numeric; minimum numeric:=10; acquired numeric; total numeric; weighted numeric; weights numeric;
 complete boolean; block_complete boolean; block_avg numeric; valid_block boolean; decision text; filiere_name text; summary jsonb;
begin
 if not private.is_super() and not (_institution=private.institution_id() and private.can_module('cloture')) then raise insufficient_privilege;end if;
 if _year!~'^20[0-9]{2}-20[0-9]{2}$' then raise exception 'Année invalide.';end if;
 select * into inst from public.institutions where id=_institution;if not found then raise exception 'Établissement introuvable.';end if;
 select * into param from public.parametres_etablissement where institution_id=_institution limit 1;
 minimum:=coalesce(nullif(param.note_min_validation,0),10);
 for p in select pr.* from public.profiles pr where pr.institution_id=_institution and exists(select 1 from public.user_roles r where r.user_id=pr.user_id and r.role='user') and not exists(select 1 from public.user_roles r where r.user_id=pr.user_id and r.role in ('admin','professor','parent','super_admin'))
  and (exists(select 1 from public.student_years y where y.user_id=pr.user_id and y.institution_id=_institution and y.academic_year=_year)
    or _year=inst.academic_year or exists(select 1 from public.grades gr where gr.user_id=pr.user_id and gr.institution_id=_institution and gr.academic_year=_year)) order by pr.last_name,pr.first_name
 loop
  select * into student_year from public.student_years where user_id=p.user_id and institution_id=_institution and academic_year=_year limit 1;
  level:=coalesce(nullif(student_year.niveau,''),p.level);programme:=coalesce(student_year.filiere_id,p.filiere_id);
  lines:='[]';groups:='[]';acquired:=0;total:=0;weighted:=0;weights:=0;complete:=true;
  for s in select su.*, (select u.id from public.ues u join public.ue_matieres m on m.ue_id=u.id where m.subject_id=su.id and u.institution_id=_institution and u.academic_year=_year order by u.id limit 1) ue_id
   from public.subjects su where su.institution_id=_institution and (su.academic_year=_year or su.academic_year='')
   and (su.filiere_id=programme or exists(select 1 from public.enrollments e where e.subject_id=su.id and e.user_id=p.user_id))
   and (su.level=level or level=any(su.levels)) and (su.campus_id is null or su.campus_id=p.campus_id) order by su.semester,su.name
  loop
   if (select count(*) from public.grades where institution_id=_institution and user_id=p.user_id and subject_id=s.id and academic_year=_year)>1 then raise exception 'Notes en doublon pour une matière : corriger avant validation.';end if;
   select * into g from public.grades where institution_id=_institution and user_id=p.user_id and subject_id=s.id and academic_year=_year limit 1;
   note:=case when coalesce(g.submission_status,'') in ('','submitted') then g.average else null end;final_note:=note;
   select greatest(coalesce(note,0),r.rattrapage_grade) into final_note from public.rattrapages r where r.user_id=p.user_id and r.subject_id=s.id and r.academic_year=_year and r.status='passed' and r.rattrapage_grade is not null order by r.rattrapage_grade desc limit 1;
   final_note:=coalesce(final_note,note);if final_note is null then complete:=false;end if;
   lines:=lines||jsonb_build_array(jsonb_build_object('id',g.id,'subject_id',s.id,'subjects',to_jsonb(s),'subject_name',s.name,'semester',s.semester,'average',final_note,'cc_grade',g.cc_grade,'exam_grade',g.exam_grade,'credits',s.credits,'coefficient',s.coefficient,'ue_id',s.ue_id));
  end loop;
  if jsonb_array_length(lines)=0 then complete:=false;end if;
  for b in select coalesce(x->>'ue_id','orphans') group_id,x->>'semester' semester,jsonb_agg(x) rows from jsonb_array_elements(lines) x group by coalesce(x->>'ue_id','orphans'),x->>'semester'
  loop
   select count(*)=count(nullif(x->>'average','')),sum((x->>'average')::numeric*(x->>'coefficient')::numeric)/nullif(sum(case when x->>'average' is not null then (x->>'coefficient')::numeric else 0 end),0)
   into block_complete,block_avg from jsonb_array_elements(b.rows) x;
   valid_block:=block_complete and block_avg>=minimum;
   if param.mode_validation_ue='STRICT' then select block_complete and bool_and((x->>'average')::numeric>=minimum) into valid_block from jsonb_array_elements(b.rows) x;end if;
   select total+coalesce(sum((x->>'credits')::numeric),0),acquired+coalesce(sum(case when valid_block or (x->>'average')::numeric>=minimum then (x->>'credits')::numeric else 0 end),0),weighted+coalesce(sum((x->>'average')::numeric*(x->>'coefficient')::numeric),0),weights+coalesce(sum(case when x->>'average' is not null then (x->>'coefficient')::numeric else 0 end),0)
    into total,acquired,weighted,weights from jsonb_array_elements(b.rows) x;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(u)||jsonb_build_object('subjects',(select jsonb_agg(l) from jsonb_array_elements(lines) l where l->>'ue_id'=u.id::text))),'[]') into groups from public.ues u where u.institution_id=_institution and u.academic_year=_year and exists(select 1 from jsonb_array_elements(lines) l where l->>'ue_id'=u.id::text);
  decision:=case when not complete then 'incomplet' when acquired>=coalesce(inst.credits_max_passage,60) then 'admis' when acquired>=coalesce(inst.credits_min_passage,45) then 'admis_conditionnel' else 'redoublant' end;
  select name into filiere_name from public.filieres where id=programme and institution_id=_institution;
  result:=result||jsonb_build_array(jsonb_build_object('user_id',p.user_id,'first_name',p.first_name,'last_name',p.last_name,'student_number',p.student_number,'filiere_id',programme,'filiere_name',filiere_name,'level',level,'old_level',level,'campus_id',p.campus_id,'grade_lines',lines,'ue_groups',groups,'credits_acquired',acquired,'credits_total',total,'credits_min_passage',inst.credits_min_passage,'credits_max_passage',inst.credits_max_passage,'weighted_average',round(weighted/nullif(weights,0),2),'decision',decision,'complete',complete));
 end loop;
 select jsonb_build_object('total',count(*),'admis',count(*) filter(where x->>'decision'='admis'),'admis_conditionnel',count(*) filter(where x->>'decision'='admis_conditionnel'),'redoublants',count(*) filter(where x->>'decision'='redoublant'),'incomplets',count(*) filter(where x->>'decision'='incomplet')) into summary from jsonb_array_elements(result) x;
 return jsonb_build_object('academic_year',_year,'results',result,'summary',summary,'params',coalesce(to_jsonb(param),'{}'));
end $$;
revoke all on function public.academic_results(uuid,text) from public;
grant execute on function public.academic_results(uuid,text) to authenticated;

create function public.submit_academic_results(_institution uuid,_year text,_filieres uuid[] default null,_levels text[] default null) returns uuid language plpgsql security definer set search_path='' as $$
declare prepared jsonb; selected jsonb; result_id uuid; first_result_id uuid; campus_group record;
begin
 if not private.is_super() and not (_institution=private.institution_id() and private.can_module('cloture')) then raise insufficient_privilege;end if;
 if _year is distinct from (select academic_year from public.institutions where id=_institution) then raise exception 'Seule l’année active peut être soumise.';end if;
 lock table public.grades in share row exclusive mode;
 prepared:=public.academic_results(_institution,_year);
 select coalesce(jsonb_agg(x),'[]') into selected from jsonb_array_elements(prepared->'results') x where (_filieres is null or cardinality(_filieres)=0 or (x->>'filiere_id')::uuid=any(_filieres)) and (_levels is null or cardinality(_levels)=0 or x->>'level'=any(_levels));
 if jsonb_array_length(selected)=0 then raise exception 'Aucun résultat dans la sélection.';end if;
 if exists(select 1 from jsonb_array_elements(selected) x where not (x->>'complete')::boolean) then raise exception 'Résultats incomplets : saisir toutes les notes avant transmission.';end if;
 if exists(select 1 from public.document_validations d where d.institution_id=_institution and d.academic_year=_year and d.status in ('pending','validated') and exists(select 1 from jsonb_array_elements(d.payload->'results') a join jsonb_array_elements(selected) b on a->>'user_id'=b->>'user_id')) then raise exception 'Une validation existe déjà pour ces étudiants et cette année.';end if;
 for campus_group in select x->>'campus_id' campus,x->>'level' level,jsonb_agg(x) rows from jsonb_array_elements(selected) x group by x->>'campus_id',x->>'level' loop
 insert into public.document_validations(institution_id,document_type,academic_year,title,status,pedagogique_status,cycle_status,created_by,payload)
 values(_institution,'releve',_year,'Relevés — '||_year||' — '||campus_group.level||' — '||jsonb_array_length(campus_group.rows)||' étudiant(s)','pending','pending','pending',auth.uid()::text,jsonb_build_object('kind','class_releves','academicYear',_year,'results',campus_group.rows,'params',prepared->'params','snapshot_at',now())) returning id into result_id;
 first_result_id:=coalesce(first_result_id,result_id);
 end loop;
 update public.grades set is_locked=true where institution_id=_institution and academic_year=_year and user_id in(select (x->>'user_id')::uuid from jsonb_array_elements(selected) x);
 return first_result_id;
end $$;
revoke all on function public.submit_academic_results(uuid,text,uuid[],text[]) from public;
grant execute on function public.submit_academic_results(uuid,text,uuid[],text[]) to authenticated;

create function private.can_review_document(d public.document_validations) returns boolean language sql stable security definer set search_path='' as $$
 select d.institution_id=private.institution_id() and private.can_module('director_documents')
 and (case when d.student_user_id is not null then private.director_student(d.student_user_id,'director_documents')
  when jsonb_array_length(coalesce(d.payload->'results','[]'))>0 then not exists(select 1 from jsonb_array_elements(d.payload->'results') x where not private.director_student((x->>'user_id')::uuid,'director_documents')) else false end)
$$;
revoke all on function private.can_review_document(public.document_validations) from public;
grant execute on function private.can_review_document(public.document_validations) to authenticated;
create policy reviewer_read on public.document_validations for select to authenticated using(private.can_review_document(document_validations));
create policy reviewer_update on public.document_validations for update to authenticated using(private.can_review_document(document_validations)) with check(private.can_review_document(document_validations));
create policy signature_owner on public.director_signatures for all to authenticated using(user_id=auth.uid() and institution_id=private.institution_id() and private.can_module('director_signature')) with check(user_id=auth.uid() and institution_id=private.institution_id() and private.can_module('director_signature'));
create policy reviewer_signatures on public.director_signatures for select to authenticated using(institution_id=private.institution_id() and private.can_module('director_documents'));
create function private.guard_validation() returns trigger language plpgsql security definer set search_path='' as $$
declare role text; stage text; allowed text[]; signature uuid; expected_scope text; data jsonb:=to_jsonb(new); olddata jsonb:=to_jsonb(old);
begin
 if auth.uid() is null or private.is_super() then return new;end if;
 if old.status='validated' then raise exception 'Document validé immuable : créer une nouvelle version.';end if;
 select team_role into role from public.team_members where user_id=auth.uid() and institution_id=new.institution_id;
 stage:=case role when 'responsable_pedagogique' then 'pedagogique' when 'responsable_cycle' then 'cycle' when 'directeur' then 'final' else null end;
 if stage is null then raise insufficient_privilege using message='Seul le signataire habilité peut valider.';end if;
 if stage='final' then
  allowed:=array['status','signature_id','validated_at','validated_by','rejection_reason','updated_at'];signature:=new.signature_id;expected_scope:='directeur';
  if new.status='validated' and (old.pedagogique_status<>'validated' or old.cycle_status<>'validated') then raise exception 'Double validation préalable requise.';end if;
  new.validated_by:=auth.uid()::text;new.validated_at:=now()::text;
 else
  allowed:=array[stage||'_status',stage||'_signature_id',stage||'_signed_at',stage||'_signed_by',stage||'_rejection_reason','updated_at'];
  if stage='cycle' and old.pedagogique_status<>'validated' then raise exception 'Validation pédagogique préalable requise.';end if;
  signature:=nullif(data->>(stage||'_signature_id'),'')::uuid;expected_scope:=role;
  if data->>(stage||'_status') not in ('validated','rejected') then raise exception 'Décision invalide.';end if;
  new:=jsonb_populate_record(new,jsonb_build_object(stage||'_signed_by',auth.uid(),stage||'_signed_at',now()::text));
 end if;
 if (data-allowed) is distinct from (olddata-allowed) then raise insufficient_privilege using message='Modification hors du périmètre de validation.';end if;
 if (stage='final' and new.status='validated') or (stage<>'final' and data->>(stage||'_status')='validated') then
  if not exists(select 1 from public.director_signatures s where s.id=signature and s.user_id=auth.uid() and s.institution_id=new.institution_id and s.role_scope=expected_scope and s.is_active and s.signature_url is not null) then raise exception 'Votre signature active est requise.';end if;
 end if;
 if stage<>'final' and data->>(stage||'_status')='rejected' and length(trim(coalesce(data->>(stage||'_rejection_reason'),'')))<3 then raise exception 'Motif de rejet requis.';end if;
 if stage='final' and new.status='to_correct' and length(trim(coalesce(new.rejection_reason,'')))<3 then raise exception 'Motif de rejet requis.';end if;
 if stage='final' and new.status not in ('validated','to_correct') then raise exception 'Décision finale invalide.';end if;
 return new;
end $$;
create trigger guard_validation before update on public.document_validations for each row execute function private.guard_validation();
-- Rejecting a stage returns the snapshot for correction; later signatures cannot survive.
create function private.initialize_validation() returns trigger language plpgsql set search_path='' as $$
begin
 new.status:='pending';new.pedagogique_status:='pending';new.cycle_status:='pending';new.signature_id:=null;new.pedagogique_signature_id:=null;new.cycle_signature_id:=null;
 new.validated_by:=null;new.validated_at:=null;new.pedagogique_signed_by:=null;new.cycle_signed_by:=null;return new;
end $$;
create trigger initialize_validation before insert on public.document_validations for each row execute function private.initialize_validation();
create function private.return_rejected_validation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (new.pedagogique_status='rejected' and old.pedagogique_status is distinct from new.pedagogique_status) or (new.cycle_status='rejected' and old.cycle_status is distinct from new.cycle_status) then
  new.status:='to_correct';new.signature_id:=null;
 end if;return new;
end $$;
create trigger return_rejected_validation before update on public.document_validations for each row execute function private.return_rejected_validation();
create function public.reopen_academic_document(_document uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.document_validations;
begin
 select * into d from public.document_validations where id=_document for update;
 if not private.is_super() and not (d.institution_id=private.institution_id() and private.is_admin()) then raise insufficient_privilege;end if;
 if d.status<>'to_correct' then raise exception 'Seul un dossier retourné pour correction peut être rouvert.';end if;
 update public.grades set is_locked=false where institution_id=d.institution_id and academic_year=d.academic_year and user_id in(select (x->>'user_id')::uuid from jsonb_array_elements(d.payload->'results') x);
end $$;
revoke all on function public.reopen_academic_document(uuid) from public;
grant execute on function public.reopen_academic_document(uuid) to authenticated;
create function public.student_validated_bulletin(_student uuid,_year text,_period text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.document_validations; student_result jsonb;
begin
 if not private.can_read_student(_student) and not (private.is_admin() and private.same_institution(_student)) then raise insufficient_privilege;end if;
 select v.* into d from public.document_validations v where v.status='validated' and v.academic_year=_year and (_period is null or v.payload->>'trimestre'=_period)
  and exists(select 1 from public.profiles p where p.user_id=_student and p.institution_id=v.institution_id)
  and exists(select 1 from jsonb_array_elements(v.payload->'results') x where x->>'user_id'=_student::text) order by v.created_at desc limit 1;
 if d.id is null then return null;end if;
 select x into student_result from jsonb_array_elements(d.payload->'results') x where x->>'user_id'=_student::text;
 return to_jsonb(d)||jsonb_build_object('payload',(d.payload-array['results','eleves','class_all_grades'])||jsonb_build_object('results',jsonb_build_array(student_result)));
end $$;
revoke all on function public.student_validated_bulletin(uuid,text,text) from public;
grant execute on function public.student_validated_bulletin(uuid,text,text) to authenticated;
create policy approved_signature_read on public.director_signatures for select to authenticated using(exists(
 select 1 from public.document_validations d where d.status='validated' and director_signatures.id in(d.pedagogique_signature_id,d.cycle_signature_id,d.signature_id)
 and (d.student_user_id=auth.uid() or exists(select 1 from jsonb_array_elements(d.payload->'results') x where private.can_read_student((x->>'user_id')::uuid)))
));
create function private.can_read_signature(_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.director_signatures s where s.id=_id and (s.user_id=auth.uid() or private.is_super() or (private.is_admin() and s.institution_id=private.institution_id()) or exists(
 select 1 from public.document_validations d where s.id in(d.signature_id,d.pedagogique_signature_id,d.cycle_signature_id) and
 (private.can_review_document(d) or (d.status='validated' and exists(select 1 from jsonb_array_elements(d.payload->'results') x where private.can_read_student((x->>'user_id')::uuid)))))))
$$;
revoke all on function private.can_read_signature(uuid) from public;
grant execute on function private.can_read_signature(uuid) to authenticated;
drop policy approved_signature_read on public.director_signatures;
create policy approved_signature_read on public.director_signatures for select to authenticated using(private.can_read_signature(id));
create policy signed_asset_read on storage.objects for select to authenticated using(bucket_id='signatures' and exists(select 1 from public.director_signatures s where private.can_read_signature(s.id) and
 (name=split_part(s.signature_url,'/signatures/',2) or name=s.signature_url or name=split_part(s.stamp_url,'/signatures/',2) or name=s.stamp_url)));
