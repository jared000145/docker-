create function private.branding(i public.institutions) returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('id',i.id,'name',i.name,'slug',i.slug,'logo_url',i.logo_url,'slogan',i.slogan,
    'primary_color',i.primary_color,'secondary_color',i.secondary_color,'accent_color',i.accent_color,
    'cover_image_url',i.cover_image_url,'institution_type',i.institution_type,'is_active',i.is_active,
    'login_title',i.login_title,'login_subtitle',i.login_subtitle,'login_layout',i.login_layout,
    'login_overlay',i.login_overlay,'login_button_color',i.login_button_color)
$$;
create function public.get_institution_by_slug(_slug text) returns jsonb language sql stable security definer set search_path = '' as $$
  select private.branding(i) from public.institutions i where lower(i.slug) = lower(_slug) limit 1
$$;
create function public.get_institution_by_domain(_domain text) returns jsonb language sql stable security definer set search_path = '' as $$
  select private.branding(i) from public.institutions i where lower(coalesce(i.custom_domain,i.domain)) = lower(_domain) limit 1
$$;
create function public.verify_access_key(_key text) returns jsonb language sql stable security definer set search_path = '' as $$
  select private.branding(i) from public.institutions i where i.is_active and length(i.access_key) >= 12 and upper(i.access_key) = upper(trim(_key)) limit 1
$$;
create function public.verify_institution_access_key(_slug text, _key text) returns jsonb language sql stable security definer set search_path = '' as $$
  select private.branding(i) from public.institutions i where lower(i.slug) = lower(_slug) and i.is_active and length(i.access_key) >= 12 and upper(i.access_key) = upper(trim(_key)) limit 1
$$;
create function public.get_user_permissions(_user_id uuid) returns text[] language plpgsql stable security definer set search_path = '' as $$
begin
  if _user_id <> auth.uid() or auth.uid() is null then raise insufficient_privilege; end if;
  return array(select distinct p.key from public.permissions p join public.role_permissions rp on rp.permission_id = p.id join public.user_roles_v2 ur on ur.role_id = rp.role_id where ur.user_id = _user_id and ur.institution_id = private.institution_id());
end $$;
create function public.get_student_access(_user_id uuid) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare y public.student_years; active boolean;
begin
  if not private.can_read_student(_user_id) and not (private.is_admin() and exists(select 1 from public.profiles where user_id=_user_id and institution_id=private.institution_id())) then raise insufficient_privilege; end if;
  select i.is_active and private.subscription_active(i.id) into active from public.profiles p join public.institutions i on i.id=p.institution_id where p.user_id=_user_id;
  select * into y from public.student_years where user_id=_user_id order by academic_year desc limit 1;
  return jsonb_build_object('allowed',coalesce(active,false) and coalesce(y.can_access,true),'status',coalesce(y.status,'active'),'reason',y.block_reason,'restricted',case when coalesce(active,false) and coalesce(y.can_access,true) then '[]'::jsonb else '["all"]'::jsonb end);
end $$;
create function public.has_new_year_access(_user_id uuid, _academic_year text default null) returns boolean language sql stable security invoker set search_path = '' as $$
  select coalesce((select can_access from public.student_years where user_id=_user_id and (_academic_year is null or academic_year=_academic_year) order by academic_year desc limit 1),true)
$$;

-- Account provisioning is transactional after Auth creation. Only the server service role may call it.
create function public.provision_account(_user_id uuid, _institution_id uuid, _role text, _profile jsonb, _team jsonb default null, _children uuid[] default '{}') returns void language plpgsql security definer set search_path = '' as $$
declare parent_key uuid;
begin
  if _role not in ('user','professor','parent','admin','super_admin') then raise exception 'Invalid role'; end if;
  update public.profiles set institution_id=_institution_id,
    first_name=coalesce(_profile->>'first_name',''), last_name=coalesce(_profile->>'last_name',''),
    student_number=nullif(_profile->>'student_number',''), phone=nullif(_profile->>'phone',''),
    level=nullif(_profile->>'level',''), academic_year=nullif(_profile->>'academic_year',''), department=nullif(_profile->>'department',''),
    filiere_id=nullif(_profile->>'filiere_id','')::uuid, classe_id=nullif(_profile->>'classe_id','')::uuid,
    date_of_birth=nullif(_profile->>'date_of_birth',''), birth_place=nullif(_profile->>'birth_place',''),
    address=nullif(_profile->>'address',''), nationality=nullif(_profile->>'nationality',''),
    sexe=nullif(_profile->>'sexe',''), serie=nullif(_profile->>'serie',''),
    parent_contact=nullif(_profile->>'parent_contact',''), tuteur_email=nullif(_profile->>'tuteur_email',''),
    recovery_email=nullif(_profile->>'recovery_email',''),
    statut_boursier=coalesce((_profile->>'statut_boursier')::boolean,false),
    oriente_etat=coalesce((_profile->>'oriente_etat')::boolean,false)
  where user_id=_user_id;
  if not found then raise exception 'Auth profile missing'; end if;
  delete from public.user_roles where user_id=_user_id;
  insert into public.user_roles(user_id,role) values(_user_id,_role::public.app_role);
  if _role='parent' then
    if exists(select 1 from unnest(_children) c left join public.profiles p on p.user_id=c where p.institution_id is distinct from _institution_id) then raise exception 'Invalid child institution'; end if;
    insert into public.parents(user_id,institution_id,email,full_name,phone) select user_id,institution_id,coalesce(email,''),first_name||' '||last_name,phone from public.profiles where user_id=_user_id returning id into parent_key;
    insert into public.parent_students(parent_id,student_user_id) select parent_key,unnest(_children);
  end if;
  if _team is not null then
    insert into public.team_members(user_id,institution_id,email,first_name,last_name,team_role,is_principal,allowed_modules)
    select user_id,institution_id,coalesce(email,''),first_name,last_name,
      coalesce(_team->>'team_role','role_personnalise')::public.team_role_type,
      coalesce((_team->>'is_principal')::boolean,false),
      array(select jsonb_array_elements_text(coalesce(_team->'allowed_modules','[]'::jsonb)))
    from public.profiles where user_id=_user_id;
  end if;
end $$;
revoke all on function public.provision_account(uuid,uuid,text,jsonb,jsonb,uuid[]) from public,anon,authenticated;
grant execute on function public.provision_account(uuid,uuid,text,jsonb,jsonb,uuid[]) to service_role;

-- Guard personal edits without blocking institutional staff updates.
grant update on public.profiles to authenticated;
create function private.protect_profile() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or private.is_super() then return new; end if;
  if new.user_id <> old.user_id or new.institution_id is distinct from old.institution_id then raise insufficient_privilege; end if;
  if private.is_admin() then return new; end if;
  if (to_jsonb(new) - array['first_name','last_name','phone','address','avatar_url','recovery_email','signature_url','updated_at']) is distinct from
     (to_jsonb(old) - array['first_name','last_name','phone','address','avatar_url','recovery_email','signature_url','updated_at']) then raise insufficient_privilege; end if;
  new.updated_at=now(); return new;
end $$;
create trigger protect_profile before update on public.profiles for each row execute function private.protect_profile();
revoke all on all functions in schema public from public;
grant execute on function public.get_institution_by_slug(text), public.get_institution_by_domain(text), public.verify_access_key(text), public.verify_institution_access_key(text,text) to anon,authenticated;
grant execute on function public.get_user_permissions(uuid), public.get_student_access(uuid), public.has_new_year_access(uuid,text) to authenticated;
