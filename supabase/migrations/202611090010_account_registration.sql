create or replace function public.provision_account(_user_id uuid, _institution_id uuid, _role text, _profile jsonb, _team jsonb default null, _children uuid[] default '{}') returns void language plpgsql security definer set search_path = '' as $$
declare parent_key uuid; current_year text; selected_campus uuid; source_campus uuid;
begin
  if _role not in ('user','professor','parent','admin','super_admin') then raise exception 'Invalid role'; end if;
  select academic_year into current_year from public.institutions where id=_institution_id;
  if current_year is null then raise exception 'Établissement introuvable.';end if;
  if nullif(_profile->>'filiere_id','') is not null then
   select campus_id into source_campus from public.filieres where id=(_profile->>'filiere_id')::uuid and institution_id=_institution_id;
   if not found then raise exception 'Filière étrangère.';end if;
  end if;
  selected_campus:=coalesce(nullif(_profile->>'campus_id','')::uuid,source_campus);
  if nullif(_profile->>'classe_id','') is not null then
   select campus_id into source_campus from public.classes where id=(_profile->>'classe_id')::uuid and institution_id=_institution_id and academic_year=coalesce(nullif(_profile->>'academic_year',''),current_year) and niveau=_profile->>'level';
   if not found then raise exception 'Classe incompatible avec l’établissement, l’année ou le niveau.';end if;
   if selected_campus is not null and source_campus is not null and selected_campus<>source_campus then raise exception 'Campus incompatible avec la classe.';end if;
   selected_campus:=coalesce(selected_campus,source_campus);
  end if;
  if selected_campus is not null and not exists(select 1 from public.campuses where id=selected_campus and institution_id=_institution_id and is_active) then raise exception 'Campus étranger ou inactif.';end if;
  update public.profiles set institution_id=_institution_id,campus_id=selected_campus,
    first_name=coalesce(_profile->>'first_name',''), last_name=coalesce(_profile->>'last_name',''),
    student_number=nullif(_profile->>'student_number',''), phone=nullif(_profile->>'phone',''),
    level=nullif(_profile->>'level',''), academic_year=coalesce(nullif(_profile->>'academic_year',''),current_year), department=nullif(_profile->>'department',''),
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
  if _role='user' then
    insert into public.student_years(user_id,institution_id,academic_year,niveau,filiere_id,enrollment_status,can_access,status)
     select user_id,institution_id,academic_year,coalesce(level,''),filiere_id,'active',true,'active' from public.profiles p where p.user_id=_user_id
      and not exists(select 1 from public.student_years y where y.user_id=_user_id and y.academic_year=p.academic_year and y.institution_id=p.institution_id);
  end if;
  if _role='parent' then
    if exists(select 1 from unnest(_children) c left join public.profiles p on p.user_id=c where p.institution_id is distinct from _institution_id) then raise exception 'Invalid child institution'; end if;
    insert into public.parents(user_id,institution_id,email,full_name,phone) select user_id,institution_id,coalesce(email,''),first_name||' '||last_name,phone from public.profiles where user_id=_user_id returning id into parent_key;
    insert into public.parent_students(parent_id,student_user_id) select parent_key,unnest(_children);
  end if;
  if _team is not null then
    insert into public.team_members(user_id,institution_id,email,first_name,last_name,team_role,is_principal,allowed_modules,academic_scope)
    select user_id,institution_id,coalesce(email,''),first_name,last_name,
      coalesce(_team->>'team_role','role_personnalise')::public.team_role_type,
      coalesce((_team->>'is_principal')::boolean,false),
      array(select jsonb_array_elements_text(coalesce(_team->'allowed_modules','[]'::jsonb))),coalesce(_team->>'academic_scope','all')
    from public.profiles where user_id=_user_id;
  end if;
end $$;
