-- Verification and PDF use the same frozen grading policy, never current live notes.
create function private.snapshot_university_summary(_student jsonb,_params jsonb) returns jsonb language sql immutable set search_path='' as $$
 with raw as(select x,case upper(coalesce(_student->>'old_level',_student->>'level','L1')) when 'L2' then 3 when 'L3' then 5 when 'M1' then 7 when 'M2' then 9 when 'D1' then 11 when 'D2' then 13 when 'D3' then 15 else 1 end first_sem from jsonb_array_elements(_student->'grade_lines') x),
 normalized as(select x,first_sem,upper(trim(coalesce(nullif(x->>'semester',''),x->'subjects'->>'semester',''))) semester from raw),
 lines as(select case when semester ~ '^S0*1$' or semester ~ '^(P|T|SEM|SEMESTRE)\s*0*1$' or semester in('1','01') then 'S'||first_sem when semester ~ '^S0*2$' or semester ~ '^(P|T|SEM|SEMESTRE)\s*0*2$' or semester in('2','02') then 'S'||(first_sem+1) when semester ~ '^S[0-9]+$' then semester else 'S'||first_sem end period,coalesce(x->>'ue_id','orphans') ue,(x->>'average')::numeric note,coalesce(nullif(coalesce(x->'subjects'->>'coefficient',x->>'coefficient')::numeric,0),1) coefficient,coalesce(coalesce(x->'subjects'->>'credits',x->>'credits')::numeric,0) credits from normalized),
 blocks as(select period,ue,sum(note*coefficient)/nullif(sum(coefficient)filter(where note is not null),0) average,sum(credits) credits from lines group by period,ue),
 sems as(select b.period,case coalesce(_params->>'mode_calcul_moyenne_semestre','MOYENNE_UE_PONDEREE') when 'MOYENNE_UE_PONDEREE' then sum(b.average*b.credits)/nullif(sum(b.credits)filter(where b.average is not null and b.credits>0),0) when 'MOYENNE_UE_SIMPLE' then avg(b.average) when 'MOYENNE_MATIERES_SIMPLE' then (select avg(l.note)from lines l where l.period=b.period) else (select sum(l.note*l.coefficient)/nullif(sum(l.coefficient)filter(where l.note is not null),0)from lines l where l.period=b.period) end average,sum(b.credits) credits from blocks b group by b.period)
 select jsonb_build_object('average',round(case when sum(credits)>0 then sum(coalesce(average,0)*credits)/sum(credits) else avg(average) end,2),'semesters',coalesce(jsonb_agg(jsonb_build_object('period',period,'average',round(average,2)) order by period),'[]'))from sems;
$$;
create or replace function public.verify_academic_document(_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d public.document_validations; student uuid; r jsonb; inst public.institutions; semesters jsonb; average numeric; summary jsonb;
begin
 if _token is null or _token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null;end if;
 select l.student_id into student from public.academic_verification_links l where l.token=_token::uuid;
 select v.* into d from public.academic_verification_links l join public.document_validations v on v.id=l.document_id where l.token=_token::uuid;
 if d.id is null then return null;end if;
 if d.status<>'validated' or d.pedagogique_status is distinct from 'validated' or d.cycle_status is distinct from 'validated' or d.signature_id is null or d.pedagogique_signature_id is null or d.cycle_signature_id is null then return jsonb_build_object('status','revoked');end if;
 select x into r from jsonb_array_elements(d.payload->'results') x where x->>'user_id'=student::text;
 if r is null then return null;end if;
 select * into inst from public.institutions where id=d.institution_id;
 if d.payload->>'kind'='class_releves' then summary:=private.snapshot_university_summary(r,coalesce(d.payload->'params','{}'));semesters:=summary->'semesters';end if;
 if d.payload->>'kind'='class_bulletins_trimestre' then
  select round(sum(s.note*s.coefficient)/nullif(sum(s.coefficient),0),2) into average from (
   select (select avg((n.value)::numeric*case when (g->>n.scale)::numeric=10 then 2 else 1 end) from (values(g->>'note1','bareme1'),(g->>'note2','bareme2'),(g->>'note3','bareme3'))n(value,scale) where n.value is not null) as note,coalesce(nullif((g->>'coefficient')::numeric,0),1) as coefficient
   from jsonb_array_elements(r->'grade_lines') g
  )s where s.note is not null;
 else average:=(summary->>'average')::numeric;end if;
 return jsonb_build_object('status','verified','reference',_token,'document_id',d.id,'type',d.document_type,'institution',inst.name,'institution_logo',inst.logo_url,'year',d.academic_year,'issued_at',d.validated_at,
 'student',jsonb_build_object('first_name',r->>'first_name','last_name',r->>'last_name','number',r->>'student_number','level',coalesce(r->>'old_level',r->>'level'),'programme',r->>'filiere_name','class',d.payload->'classe'->>'nom'),
 'results',jsonb_build_object('period',coalesce(d.payload->>'trimestre','Année universitaire'),'average',average,'credits',r->'credits_acquired','total_credits',r->'credits_total','decision',coalesce(r->>'decision',r->>'appreciation',case when d.payload->>'kind'='class_bulletins_trimestre' and average is not null then case when average>=10 then 'Admis' else 'Redouble' end end),'rank',r->'rang','semesters',semesters));
end $$;

create or replace function public.verify_student_card(_token text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',case when i.is_active and i.academic_year=l.academic_year and y.can_access and y.enrollment_status in('active','repeating') then 'active' else 'inactive' end,'institution',i.name,'institution_logo',i.logo_url,'year',l.academic_year,'first_name',p.first_name,'last_name',p.last_name,'number',p.student_number,'level',y.niveau,'class',c.nom,'campus',ca.name)
 from public.student_card_links l join public.institutions i on i.id=l.institution_id join public.profiles p on p.user_id=l.student_id and p.institution_id=i.id join public.student_years y on y.user_id=l.student_id and y.institution_id=i.id and y.academic_year=l.academic_year left join public.classes c on c.id=y.classe_id left join public.campuses ca on ca.id=y.campus_id where l.token=case when _token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then _token::uuid else null end;
$$;
