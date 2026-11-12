-- Server-owned intake sessions. Upload tokens and submitted identity documents are never public.
create table private.intake_sessions (
  id uuid primary key, token_hash text not null, payload jsonb not null, paths jsonb not null,
  expires_at timestamptz not null default now()+interval '2 hours', submitted_id uuid
);
create table private.intake_limits (key text primary key, started_at timestamptz not null, attempts integer not null);
alter table public.institution_preregistrations alter column status set default 'pending';
alter table public.institution_preregistrations alter column domain_mode set default 'path';
alter table public.institution_subscriptions add unique (institution_id);
alter table public.team_members add unique (user_id);
alter table public.institution_subscriptions add constraint subscription_values check (
  amount>=0 and billing_cycle in ('monthly','annual') and status in ('trialing','active','blocked','cancelled','expired')
  and ends_at::date>starts_at::date
);

create function public.begin_preregistration(_id uuid,_token_hash text,_payload jsonb,_paths jsonb,_rate_key text) returns void language plpgsql security definer set search_path='' as $$
declare count_attempts integer;
begin
  insert into private.intake_limits(key,started_at,attempts) values(_rate_key,now(),1)
  on conflict(key) do update set
    attempts=case when private.intake_limits.started_at<now()-interval '1 hour' then 1 else private.intake_limits.attempts+1 end,
    started_at=case when private.intake_limits.started_at<now()-interval '1 hour' then now() else private.intake_limits.started_at end
  returning attempts into count_attempts;
  if count_attempts>5 then raise exception 'Trop de demandes. Réessayez plus tard.' using errcode='P0001'; end if;
  insert into private.intake_sessions(id,token_hash,payload,paths) values(_id,_token_hash,_payload,_paths);
end $$;

create function public.submit_preregistration(_id uuid,_token_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare intake private.intake_sessions; request_id uuid; expected text;
begin
  select * into intake from private.intake_sessions where id=_id and token_hash=_token_hash for update;
  if not found then raise exception 'Dossier introuvable.'; end if;
  if intake.submitted_id is not null then return intake.submitted_id; end if;
  if intake.expires_at<now() then raise exception 'La session de dépôt a expiré.'; end if;
  for expected in select jsonb_each_text.value from jsonb_each_text(intake.paths) loop
    if not exists(select 1 from storage.objects where bucket_id='preregistrations' and name=expected) then raise exception 'Un document requis manque au dossier.'; end if;
  end loop;
  insert into public.institution_preregistrations(institution_name,official_email,director_name,phone,address,
    desired_slug,domain_mode,institution_type,cycle,enabled_cycles,director_id_url,rccm_url,nif_url,agrement_url,logo_url,status)
  values(intake.payload->>'institution_name',intake.payload->>'official_email',intake.payload->>'director_name',
    intake.payload->>'phone',intake.payload->>'address',intake.payload->>'desired_slug','path',
    intake.payload->>'institution_type',intake.payload->>'cycle',array(select jsonb_array_elements_text(intake.payload->'enabled_cycles')),
    intake.paths->>'director_id_url',intake.paths->>'rccm_url',intake.paths->>'nif_url',intake.paths->>'agrement_url',intake.paths->>'logo_url','pending') returning id into request_id;
  update private.intake_sessions set submitted_id=request_id where id=_id;
  return request_id;
end $$;

create function public.complete_preregistration(_request_id uuid,_admin_user_id uuid,_reviewer uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare request public.institution_preregistrations; new_institution uuid; access text; school_year text; name_parts text[];
begin
  if not exists(select 1 from public.user_roles where user_id=_reviewer and role='super_admin') then raise insufficient_privilege; end if;
  select * into request from public.institution_preregistrations where id=_request_id for update;
  if not found or request.status<>'pending' then raise exception 'Ce dossier a déjà été traité ou est introuvable.'; end if;
  if not exists(select 1 from auth.users where id=_admin_user_id and lower(email)=lower(request.official_email)) then raise exception 'Le compte administrateur ne correspond pas au dossier.'; end if;
  if exists(select 1 from public.profiles where user_id=_admin_user_id and institution_id is not null) then raise exception 'Compte déjà rattaché.'; end if;
  if request.desired_slug is null or request.desired_slug !~ '^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$' or request.desired_slug in ('www','app','admin','api','preview','login','super-admin') then raise exception 'Identifiant établissement invalide.'; end if;
  access:=upper(replace(gen_random_uuid()::text,'-',''));
  school_year:=case when extract(month from current_date)>=8 then extract(year from current_date)::int::text||'-'||(extract(year from current_date)::int+1)::text else (extract(year from current_date)::int-1)::text||'-'||extract(year from current_date)::int::text end;
  insert into public.institutions(name,slug,email,phone,address,institution_type,cycle,enabled_cycles,academic_year,access_key,is_active)
  values(request.institution_name,request.desired_slug,request.official_email,request.phone,request.address,request.institution_type,request.cycle,request.enabled_cycles,school_year,access,true) returning id into new_institution;
  name_parts:=string_to_array(trim(request.director_name),' ');
  perform public.provision_account(_admin_user_id,new_institution,'admin',jsonb_build_object('first_name',name_parts[1],'last_name',coalesce(nullif(array_to_string(name_parts[2:array_length(name_parts,1)],' '),''),'Direction')),
    '{"team_role":"admin_principal","is_principal":true,"allowed_modules":[]}'::jsonb);
  insert into public.institution_subscriptions(institution_id,plan_name,billing_cycle,status,amount,currency,starts_at,ends_at,notes)
  values(new_institution,'Essai','monthly','trialing',0,'XAF',current_date::text,(current_date+14)::text,'Période de test initiale ; aucun prélèvement automatique.') on conflict(institution_id) do nothing;
  update public.institution_preregistrations set status='approved',reviewed_at=now()::text,reviewed_by=_reviewer,created_institution_id=new_institution,updated_at=now() where id=_request_id;
  return jsonb_build_object('institution_id',new_institution,'slug',request.desired_slug,'accessKey',access,'email',request.official_email,'institution',request.institution_name);
end $$;

create function public.reject_preregistration(_request_id uuid,_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_super() then raise insufficient_privilege; end if;
  if length(trim(_reason))<3 or length(_reason)>2000 then raise exception 'Motif requis (3 à 2000 caractères).'; end if;
  update public.institution_preregistrations set status='rejected',rejection_reason=trim(_reason),reviewed_at=now()::text,reviewed_by=auth.uid(),updated_at=now() where id=_request_id and status='pending';
  if not found then raise exception 'Le dossier a déjà été traité.'; end if;
end $$;

create function public.manage_institution_subscription(_institution_id uuid,_action text,_patch jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare current_sub public.institution_subscriptions; result public.institution_subscriptions; start_day date; end_day date; cycle text; new_status text; enabled boolean;
begin
  if not private.is_super() then raise insufficient_privilege; end if;
  perform 1 from public.institutions where id=_institution_id for update;
  if not found then raise exception 'Établissement introuvable.'; end if;
  select * into current_sub from public.institution_subscriptions where institution_id=_institution_id;
  cycle:=coalesce(_patch->>'billing_cycle',nullif(current_sub.billing_cycle,''),'monthly');
  if cycle not in ('monthly','annual') then raise exception 'Cycle invalide.'; end if;
  start_day:=coalesce(nullif(_patch->>'starts_at','')::date,nullif(current_sub.starts_at,'')::date,current_date);
  end_day:=coalesce(nullif(_patch->>'ends_at','')::date,nullif(current_sub.ends_at,'')::date,(current_date+interval '1 month')::date);
  new_status:=coalesce(_patch->>'status',nullif(current_sub.status,''),'active');
  if _action='renew' then
    end_day:=(greatest(coalesce(nullif(current_sub.ends_at,'')::date,current_date),current_date)+case when cycle='annual' then interval '1 year' else interval '1 month' end)::date;
    new_status:='active'; enabled:=true;
  elsif _action='suspend' then new_status:='blocked'; enabled:=false;
  elsif _action='reactivate' then
    if end_day<=current_date then raise exception 'Abonnement expiré : renouvelez avant de réactiver.'; end if;
    new_status:='active'; enabled:=true;
  elsif _action<>'update' then raise exception 'Action invalide.'; end if;
  insert into public.institution_subscriptions(institution_id,plan_name,billing_cycle,status,amount,currency,starts_at,ends_at,notes)
  values(_institution_id,coalesce(nullif(_patch->>'plan_name',''),nullif(current_sub.plan_name,''),'Standard'),cycle,new_status,
    coalesce((_patch->>'amount')::numeric,current_sub.amount,0),coalesce(nullif(current_sub.currency,''),'XAF'),start_day::text,end_day::text,current_sub.notes)
  on conflict(institution_id) do update set plan_name=excluded.plan_name,billing_cycle=excluded.billing_cycle,status=excluded.status,amount=excluded.amount,starts_at=excluded.starts_at,ends_at=excluded.ends_at,updated_at=now()
  returning * into result;
  if enabled is not null then update public.institutions set is_active=enabled where id=_institution_id; end if;
  return to_jsonb(result);
end $$;

create function private.subscription_active(institution uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.institutions i join public.institution_subscriptions s on s.institution_id=i.id
    where i.id=institution and i.is_active and s.status in ('trialing','active') and s.starts_at::date<=current_date and s.ends_at::date>current_date)
$$;
grant execute on function private.subscription_active(uuid) to authenticated;
-- The billing row and user's own profile remain readable to explain a blocked account.
do $$ declare item record; begin
  for item in select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not in ('institutions','institution_subscriptions','profiles','user_roles','permissions','institution_preregistrations') loop
    execute format('create policy subscription_gate on public.%I as restrictive for all to authenticated using (private.is_super() or private.subscription_active(private.institution_id())) with check (private.is_super() or private.subscription_active(private.institution_id()))',item.table_name);
  end loop;
end $$;
update storage.buckets set file_size_limit=10485760,allowed_mime_types=array['application/pdf','image/png','image/jpeg','image/webp'] where id='preregistrations';
revoke all on function public.begin_preregistration(uuid,text,jsonb,jsonb,text),public.submit_preregistration(uuid,text),public.complete_preregistration(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.begin_preregistration(uuid,text,jsonb,jsonb,text),public.submit_preregistration(uuid,text),public.complete_preregistration(uuid,uuid,uuid) to service_role;
revoke all on function public.reject_preregistration(uuid,text),public.manage_institution_subscription(uuid,text,jsonb) from public,anon;
grant execute on function public.reject_preregistration(uuid,text),public.manage_institution_subscription(uuid,text,jsonb) to authenticated;
revoke all on function private.subscription_active(uuid) from public;

create function private.start_institution_trial() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.institution_subscriptions(institution_id,plan_name,billing_cycle,status,amount,currency,starts_at,ends_at)
  values(new.id,'Essai','monthly','trialing',0,'XAF',current_date::text,(current_date+14)::text);
  return new;
end $$;
create trigger institution_trial after insert on public.institutions for each row execute function private.start_institution_trial();
create function public.institution_accepts_users(_institution_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select private.subscription_active(_institution_id)
$$;
revoke all on function public.institution_accepts_users(uuid) from public,anon,authenticated;
grant execute on function public.institution_accepts_users(uuid) to service_role;
