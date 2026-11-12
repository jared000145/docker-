-- Versioned tenant data, optimistic previews and atomic non-destructive recovery.
create table public.institution_data_versions (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 created_at timestamptz not null default now(), created_by uuid not null, label text not null,
 payload jsonb not null, counts jsonb not null
);
alter table public.institution_data_versions enable row level security;
grant select on public.institution_data_versions to authenticated;
create policy super_read on public.institution_data_versions for select to authenticated using(private.is_super());
create table public.institution_data_operations (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id),
 created_at timestamptz not null default now(), created_by uuid not null, operation text not null,
 counts jsonb not null, before_version_id uuid references public.institution_data_versions(id)
);
alter table public.institution_data_operations enable row level security;
grant select on public.institution_data_operations to authenticated;
create policy super_read on public.institution_data_operations for select to authenticated using(private.is_super());

create function private.data_tables() returns text[] language sql immutable set search_path='' as $$
 select array['campuses','filieres','classes','subjects','profiles','student_years','schedule_events','grades','grades_trimestre','payments','attendance']::text[]
$$;
create function private.tenant_data(_institution uuid,_tables text[]) returns jsonb language plpgsql security definer set search_path='' as $$
declare t text; result jsonb:='{}'; rows jsonb;
begin
 foreach t in array private.data_tables() loop
  if t=any(_tables) then
   execute format('select coalesce(jsonb_agg(to_jsonb(r) order by id),''[]''::jsonb) from public.%I r where institution_id=$1',t) into rows using _institution;
   result:=result||jsonb_build_object(t,rows);
  end if;
 end loop;return result;
end $$;
revoke all on function private.data_tables(),private.tenant_data(uuid,text[]) from public;

create function public.institution_data_tool(_institution uuid,_action text,_payload jsonb default '{}'::jsonb,
 _tables text[] default null,_version uuid default null,_token text default null,_mode text default 'missing') returns jsonb
language plpgsql security definer set search_path='' as $$
declare tables text[]:=coalesce(_tables,private.data_tables()); source jsonb; current_data jsonb; fingerprint text;
 t text; r jsonb; existing jsonb; safe jsonb; cols text; assignments text; rowid uuid; tenant uuid; key text; ref_table text; ref_id uuid;
 counts jsonb:='{}'; n int; inserted int:=0; updated int:=0; skipped int:=0; before_id uuid; changed int; selected int:=0;
begin
 if not private.is_super() then raise insufficient_privilege using message='Super administrateur requis.'; end if;
 if not exists(select 1 from public.institutions where id=_institution) then raise exception 'Établissement introuvable.'; end if;
 if cardinality(tables)=0 or not tables<@private.data_tables() or cardinality(tables)<> (select count(distinct x) from unnest(tables) x) then raise exception 'Modules invalides.'; end if;
 if _action not in ('snapshot','preview_import','apply_import','preview_restore','apply_restore') then raise exception 'Action invalide.'; end if;
 if _mode not in ('missing','replace') then raise exception 'Mode invalide.'; end if;
 if _action like 'apply_%' or _action='snapshot' then
  -- Briefly serialize writes for a consistent version and an optimistic apply.
  foreach t in array private.data_tables() loop
   if t=any(tables) then execute format('lock table public.%I in share row exclusive mode',t); end if;
  end loop;
 end if;
 current_data:=private.tenant_data(_institution,tables);
 if _action='snapshot' then
  for t in select jsonb_object_keys(current_data) loop counts:=counts||jsonb_build_object(t,jsonb_array_length(current_data->t));end loop;
  insert into public.institution_data_versions(institution_id,created_by,label,payload,counts)
  values(_institution,auth.uid(),left(coalesce(nullif(_payload->>'label',''),'Sauvegarde manuelle'),160),current_data,counts) returning id into before_id;
  return jsonb_build_object('version_id',before_id,'counts',counts);
 end if;
 if _action like '%restore' then
  select payload into source from public.institution_data_versions where id=_version and institution_id=_institution;
  if source is null then raise exception 'Version introuvable pour cet établissement.';end if;
  if exists(select 1 from unnest(tables) x where not source?x) then raise exception 'Module absent de cette version.';end if;
 else source:=_payload;
 end if;
 if jsonb_typeof(source)<>'object' or octet_length(source::text)>20000000 then raise exception 'Fichier invalide ou trop volumineux.';end if;
 if _action like '%import' and (source?'profiles') then raise exception 'Les comptes étudiants doivent être créés via l’import de comptes sécurisé.';end if;
 fingerprint:=md5(jsonb_build_object('institution',_institution,'source',source,'current',current_data,'tables',tables,'mode',_mode)::text);
 if _action like 'apply_%' and _token is distinct from fingerprint then raise exception 'Les données ont changé. Refaire l’aperçu avant de confirmer.';end if;
 foreach t in array private.data_tables() loop
  if not t=any(tables) then continue;end if;
  if jsonb_typeof(coalesce(source->t,'[]'))<>'array' then raise exception 'Format invalide pour %',t;end if;
  n:=jsonb_array_length(coalesce(source->t,'[]'));selected:=selected+n;
  if selected>10000 then raise exception 'Maximum 10 000 lignes par opération.';end if;
  for r in select value from jsonb_array_elements(coalesce(source->t,'[]')) loop
   if jsonb_typeof(r)<>'object' then raise exception 'Ligne invalide dans %',t;end if;
   rowid:=(r->>'id')::uuid;
   if rowid is null or (r?'institution_id' and (r->>'institution_id')::uuid is distinct from _institution) then raise exception 'Identifiant ou établissement invalide dans %',t;end if;
   execute format('select to_jsonb(x) from public.%I x where id=$1',t) into existing using rowid;
   if existing is not null and (existing->>'institution_id')::uuid is distinct from _institution then raise exception 'Identifiant appartenant à un autre établissement.';end if;
   -- All foreign keys that point at tenant rows must remain in this institution.
   for key,ref_table in select a.attname,cl.relname from pg_catalog.pg_constraint c
    join pg_catalog.pg_class cl on cl.oid=c.confrelid join pg_catalog.pg_namespace ns on ns.oid=cl.relnamespace
    join pg_catalog.pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.conrelid=('public.'||quote_ident(t))::regclass and array_length(c.conkey,1)=1
     and ns.nspname='public' and cl.relname<>'institutions'
   loop
    ref_id:=nullif(r->>key,'')::uuid;
    if ref_id is null then continue;end if;
    if exists(select 1 from information_schema.columns where table_schema='public' and table_name=ref_table and column_name='institution_id') then
     execute format('select institution_id from public.%I where %I=$1',ref_table,case when key in ('user_id','student_user_id','professor_user_id') then 'user_id' else 'id' end) into tenant using ref_id;
     if tenant is distinct from _institution and not exists(select 1 from jsonb_array_elements(coalesce(source->ref_table,'[]')) x where (x->>'id')::uuid=ref_id and coalesce((x->>'institution_id')::uuid,_institution)=_institution and ref_table=any(tables)) then raise exception 'Référence étrangère ou manquante : %.%',t,key;end if;
    end if;
   end loop;
   if _action like '%import' and t='grades' and coalesce((existing->>'is_locked')::boolean,false) then raise exception 'Note verrouillée : rouvrir la période avant import.';end if;
   if t='profiles' then
    if existing is null then raise exception 'Impossible de restaurer un compte supprimé : recréer son accès séparément.';end if;
    -- Never restore identity, tenant, roles, passwords or signatures.
    select coalesce(jsonb_object_agg(k,v),'{}') into safe from jsonb_each(r) e(k,v) where k=any(array['first_name','last_name','phone','address','level','filiere_id','classe_id','campus_id']);
   elsif _action like '%import' then
    select coalesce(jsonb_object_agg(k,v),'{}') into safe from jsonb_each(r) e(k,v) where k<>all(array['created_by','updated_by','is_locked','approved_by_student','approved_at','student_signature_url','pv_url','pv_uploaded_by','pv_uploaded_at','submission_status']);
   else safe:=r;
   end if;
   safe:=safe||jsonb_build_object('institution_id',_institution,'id',rowid);
   if existing is null then inserted:=inserted+1;
   elsif _mode='missing' or existing @> safe then skipped:=skipped+1;continue;
   else updated:=updated+1;end if;
   if _action like 'apply_%' then
    if before_id is null then
     for key in select jsonb_object_keys(current_data) loop counts:=counts||jsonb_build_object(key,jsonb_array_length(current_data->key));end loop;
     insert into public.institution_data_versions(institution_id,created_by,label,payload,counts) values(_institution,auth.uid(),'Avant '||_action,current_data,counts) returning id into before_id;
    end if;
    select string_agg(format('%I',column_name),',' order by ordinal_position),string_agg(format('%1$I=excluded.%1$I',column_name),',' order by ordinal_position)
     into cols,assignments from information_schema.columns where table_schema='public' and table_name=t and safe?column_name and column_name<>'id';
    if existing is null then
     execute format('insert into public.%1$I (id,%2$s) select id,%2$s from jsonb_populate_record(null::public.%1$I,$1)',t,cols) using safe;
    else
     execute format('update public.%1$I set (%2$s)=(select %2$s from jsonb_populate_record(null::public.%1$I,$1)) where id=$2',t,cols) using safe,rowid;
    end if;
   end if;
  end loop;
  counts:=counts||jsonb_build_object(t,n);
 end loop;
 if _action like 'apply_%' then
  insert into public.institution_data_operations(institution_id,created_by,operation,counts,before_version_id) values(_institution,auth.uid(),_action,jsonb_build_object('created',inserted,'updated',updated,'skipped',skipped,'modules',counts),before_id);
 end if;
 return jsonb_build_object('token',fingerprint,'created',inserted,'updated',updated,'skipped',skipped,'counts',counts,'before_version_id',before_id);
end $$;
revoke all on function public.institution_data_tool(uuid,text,jsonb,text[],uuid,text,text) from public;
grant execute on function public.institution_data_tool(uuid,text,jsonb,text[],uuid,text,text) to authenticated;
