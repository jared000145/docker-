create table public.academic_verification_links(
 token uuid primary key default gen_random_uuid(),document_id uuid not null references public.document_validations(id) on delete cascade,
 student_id uuid not null references auth.users(id) on delete cascade,created_at timestamptz not null default now(),unique(document_id,student_id)
);
alter table public.academic_verification_links enable row level security;
grant all on public.academic_verification_links to service_role;

create function public.issue_academic_verification(_document uuid,_student uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.document_validations; result uuid;
begin
 select * into d from public.document_validations where id=_document;
 if d.status is distinct from 'validated' or d.pedagogique_status is distinct from 'validated' or d.cycle_status is distinct from 'validated' or d.signature_id is null or d.pedagogique_signature_id is null or d.cycle_signature_id is null or not exists(select 1 from jsonb_array_elements(coalesce(d.payload->'results','[]')) x where x->>'user_id'=_student::text) then raise exception 'Seul un document validé et signé peut être vérifié.';end if;
 if not private.can_read_student(_student) and not(private.is_admin() and private.same_institution(_student)) then raise insufficient_privilege;end if;
 insert into public.academic_verification_links(document_id,student_id) values(_document,_student) on conflict(document_id,student_id) do update set student_id=excluded.student_id returning token into result;
 return result;
end $$;
create function public.verify_academic_document(_token text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d public.document_validations; student uuid; r jsonb; inst public.institutions; semesters jsonb; average numeric;
begin
 if _token is null or _token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return null;end if;
 select l.student_id into student from public.academic_verification_links l where l.token=_token::uuid;
 select v.* into d from public.academic_verification_links l join public.document_validations v on v.id=l.document_id where l.token=_token::uuid;
 if d.id is null then return null;end if;
 if d.status<>'validated' or d.pedagogique_status<>'validated' or d.cycle_status<>'validated' or d.signature_id is null or d.pedagogique_signature_id is null or d.cycle_signature_id is null then return jsonb_build_object('status','revoked');end if;
 select x into r from jsonb_array_elements(d.payload->'results') x where x->>'user_id'=student::text;
 if r is null then return null;end if;
 select * into inst from public.institutions where id=d.institution_id;
 if d.payload->>'kind'='class_releves' then
 select coalesce(jsonb_agg(to_jsonb(s)),'[]') into semesters from(select x->>'semester' as period,round(sum((x->>'average')::numeric*(x->>'coefficient')::numeric)/nullif(sum((x->>'coefficient')::numeric),0),2) as average from jsonb_array_elements(r->'grade_lines') x group by x->>'semester' order by x->>'semester')s;
 end if;
 if d.payload->>'kind'='class_bulletins_trimestre' then
  select round(sum(s.note*s.coefficient)/nullif(sum(s.coefficient),0),2) into average from (
   select (select avg((n.value)::numeric*case when (g->>n.scale)::numeric=10 then 2 else 1 end) from (values(g->>'note1','bareme1'),(g->>'note2','bareme2'),(g->>'note3','bareme3'))n(value,scale) where n.value is not null) as note,coalesce(nullif((g->>'coefficient')::numeric,0),1) as coefficient
   from jsonb_array_elements(r->'grade_lines') g
  )s where s.note is not null;
 else average:=(r->>'weighted_average')::numeric;end if;
 return jsonb_build_object('status','verified','reference',_token,'document_id',d.id,'type',d.document_type,'institution',inst.name,'institution_logo',inst.logo_url,'year',d.academic_year,'issued_at',d.validated_at,
 'student',jsonb_build_object('first_name',r->>'first_name','last_name',r->>'last_name','number',r->>'student_number','level',coalesce(r->>'old_level',r->>'level'),'programme',r->>'filiere_name','class',d.payload->'classe'->>'nom'),
 'results',jsonb_build_object('period',coalesce(d.payload->>'trimestre','Année universitaire'),'average',average,'credits',r->'credits_acquired','total_credits',r->'credits_total','decision',coalesce(r->>'decision',r->>'appreciation'),'rank',r->'rang','semesters',semesters));
end $$;
revoke all on function public.issue_academic_verification(uuid,uuid),public.verify_academic_document(text) from public;
grant execute on function public.issue_academic_verification(uuid,uuid) to authenticated;
grant execute on function public.verify_academic_document(text) to anon,authenticated;

create table public.student_card_links(token uuid primary key default gen_random_uuid(),student_id uuid not null references auth.users(id) on delete cascade,institution_id uuid not null references public.institutions(id),academic_year text not null,created_at timestamptz not null default now(),unique(student_id,institution_id,academic_year));
alter table public.student_card_links enable row level security;
grant all on public.student_card_links to service_role;
create function public.issue_student_card(_year text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; tenant uuid;
begin
 select institution_id into tenant from public.student_years where user_id=auth.uid() and academic_year=_year and exists(select 1 from public.user_roles where user_id=auth.uid() and role='user');
 if tenant is null then raise exception 'Inscription annuelle requise pour la carte.';end if;
 insert into public.student_card_links(student_id,institution_id,academic_year) values(auth.uid(),tenant,_year) on conflict(student_id,institution_id,academic_year) do update set student_id=excluded.student_id returning token into result;return result;
end $$;
create function public.verify_student_card(_token text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status',case when i.is_active and i.academic_year=l.academic_year and y.can_access and y.enrollment_status in('active','repeating') then 'active' else 'inactive' end,'institution',i.name,'institution_logo',i.logo_url,'year',l.academic_year,'first_name',p.first_name,'last_name',p.last_name,'number',p.student_number,'level',y.niveau,'class',c.nom,'campus',ca.name)
 from public.student_card_links l join public.institutions i on i.id=l.institution_id join public.profiles p on p.user_id=l.student_id and p.institution_id=i.id join public.student_years y on y.user_id=l.student_id and y.institution_id=i.id and y.academic_year=l.academic_year left join public.classes c on c.id=y.classe_id left join public.campuses ca on ca.id=y.campus_id where l.token::text=_token;
$$;
revoke all on function public.issue_student_card(text),public.verify_student_card(text) from public;
grant execute on function public.issue_student_card(text) to authenticated;
grant execute on function public.verify_student_card(text) to anon,authenticated;
