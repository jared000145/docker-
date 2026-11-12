-- Publishing bac results belongs to a Terminale registration in a lycée cycle.
create function private.can_publish_bac(_student uuid,_year text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(
  select 1 from public.student_years y
  join public.institutions i on i.id=y.institution_id
  join public.profiles p on p.user_id=y.user_id and p.institution_id=i.id
  left join public.classes c on c.id=y.classe_id and c.institution_id=i.id
  where y.user_id=_student and y.academic_year=_year and i.academic_year=_year
   and i.id=private.institution_id() and private.can_module('etudiants')
   and private.staff_person_scope(_student) and private.staff_campus(y.campus_id)
   and (case when coalesce(array_length(i.enabled_cycles,1),0)>0 then 'lycee'=any(i.enabled_cycles) else i.institution_type='highschool' end)
   and (c.cycle is null or c.cycle='lycee')
   and lower(trim(coalesce(c.niveau,y.niveau))) in('terminale','tle','t-le')
 );
$$;
create function private.guard_bac_cycle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and not private.can_publish_bac(new.user_id,new.academic_year) then
  raise exception 'La publication du baccalauréat est réservée aux élèves de Terminale du lycée pour l’année en cours.' using errcode='42501';
 end if;
 return new;
end $$;
create trigger bac_lycee_scope before insert or update on public.bac_results for each row execute function private.guard_bac_cycle();
