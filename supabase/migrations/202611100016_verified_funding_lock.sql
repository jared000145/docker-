create or replace function public.set_admission_funding(_route text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or _route not in('direct','anbg') then raise insufficient_privilege;end if;
 if _route='direct' and (exists(select 1 from public.profiles where user_id=auth.uid() and statut_boursier) or exists(select 1 from public.admission_funding where user_id=auth.uid() and status='verified_anbg')) then raise exception 'Votre statut boursier nécessite la voie ANBG et la vérification de son orientation.';end if;
 if exists(select 1 from public.applications where user_id=auth.uid() and status in('pending','in_review','accepted')) then raise exception 'La voie de financement est liée à vos candidatures en cours.';end if;
 insert into public.admission_funding(user_id,route,status) values(auth.uid(),_route,case when _route='anbg' then 'pending_anbg' else 'direct' end)
 on conflict(user_id) do update set route=excluded.route,status=excluded.status,reference=null,target_filiere_id=null,verified_by=null,verified_at=null;
end $$;

