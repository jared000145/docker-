create or replace function public.manage_campus(_institution uuid,_campus uuid default null,_data jsonb default '{}',_action text default 'save') returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; member uuid;
begin
 if not private.is_super() and not (private.is_admin() and private.institution_id()=_institution) then raise insufficient_privilege;end if;
 perform 1 from public.institutions where id=_institution for update;if not found then raise exception 'Établissement introuvable.';end if;
 if _campus is not null and not exists(select 1 from public.campuses where id=_campus and institution_id=_institution) then raise exception 'Campus étranger.';end if;
 if _action='assign' then
  member:=(_data->>'user_id')::uuid;
  if _campus is null or not exists(select 1 from public.team_members where user_id=member and institution_id=_institution) then raise exception 'Membre ou campus invalide.';end if;
  if not exists(select 1 from public.campus_staff where user_id=member and campus_id=_campus) then
   insert into public.campus_staff(user_id,campus_id,institution_id,role) values(member,_campus,_institution,'staff');
  end if;return _campus;
 elsif _action='unassign' then
  delete from public.campus_staff where campus_id=_campus and institution_id=_institution and user_id=(_data->>'user_id')::uuid; update public.profiles set campus_id=(select s.campus_id from public.campus_staff s join public.campuses c on c.id=s.campus_id where s.user_id=(_data->>'user_id')::uuid and s.institution_id=_institution and c.is_active order by c.name limit 1) where user_id=(_data->>'user_id')::uuid and institution_id=_institution and campus_id=_campus;return _campus;
 elsif _action='archive' then
  if exists(select 1 from public.campuses where id=_campus and is_main) then raise exception 'Choisissez un autre campus principal avant archivage.';end if;
  update public.campuses set is_active=false,updated_at=now() where id=_campus;return _campus;
 elsif _action<>'save' then raise exception 'Action invalide.';end if;
 if length(trim(coalesce(_data->>'name','')))<2 or length(_data->>'name')>160 or coalesce(_data->>'cycle','lmd') not in ('lmd','bts') then raise exception 'Nom ou cycle invalide.';end if;
 if coalesce((_data->>'is_main')::boolean,false) then update public.campuses set is_main=false where institution_id=_institution and id is distinct from _campus;end if;
 result:=coalesce(_campus,gen_random_uuid());
 insert into public.campuses(id,institution_id,name,city,address,phone,email,cycle,is_active,is_main)
 values(result,_institution,trim(_data->>'name'),nullif(_data->>'city',''),nullif(_data->>'address',''),nullif(_data->>'phone',''),nullif(_data->>'email',''),coalesce(_data->>'cycle','lmd'),coalesce((_data->>'is_active')::boolean,true),coalesce((_data->>'is_main')::boolean,false))
 on conflict(id) do update set name=excluded.name,city=excluded.city,address=excluded.address,phone=excluded.phone,email=excluded.email,cycle=excluded.cycle,is_active=excluded.is_active,is_main=excluded.is_main,updated_at=now();
 return result;
end $$;
revoke all on function public.manage_campus(uuid,uuid,jsonb,text) from public;
grant execute on function public.manage_campus(uuid,uuid,jsonb,text) to authenticated;
