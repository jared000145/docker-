-- Provisioning accounts must capture their first annual campus/class as well.
create or replace function private.fill_annual_identity() returns trigger language plpgsql security definer set search_path='' as $$
declare p public.profiles;
begin
 select * into p from public.profiles where user_id=new.user_id;
 if p.institution_id is distinct from new.institution_id then raise exception 'Inscription dans un établissement étranger.';end if;
 if p.academic_year=new.academic_year then new.campus_id:=coalesce(new.campus_id,p.campus_id);new.classe_id:=coalesce(new.classe_id,p.classe_id);end if;
 if new.filiere_id is not null and exists(select 1 from public.filieres f where f.id=new.filiere_id and (f.institution_id is distinct from new.institution_id or f.campus_id is not null and f.campus_id is distinct from new.campus_id)) then raise exception 'Choisissez une filière du campus de cette inscription.';end if;
 if new.classe_id is not null and not exists(select 1 from public.classes c where c.id=new.classe_id and c.institution_id=new.institution_id and c.academic_year=new.academic_year and c.niveau=new.niveau and (c.campus_id is null or c.campus_id=new.campus_id)) then raise exception 'Classe incompatible avec cette inscription annuelle.';end if;
 if new.campus_id is not null and not exists(select 1 from public.campuses where id=new.campus_id and institution_id=new.institution_id) then raise exception 'Campus étranger.';end if;
 if new.previous_year_id is not null and not exists(select 1 from public.student_years y where y.id=new.previous_year_id and y.user_id=new.user_id and y.institution_id=new.institution_id and split_part(new.academic_year,'-',1)::int=split_part(y.academic_year,'-',1)::int+1) then raise exception 'Inscription précédente incompatible.';end if;
 return new;
end $$;

create or replace function private.profile_references() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.filiere_id is not null and not exists(select 1 from public.filieres where id=new.filiere_id and institution_id=new.institution_id) then raise exception 'Filière étrangère.';end if;
 if new.classe_id is not null and not exists(select 1 from public.classes where id=new.classe_id and institution_id=new.institution_id) then raise exception 'Classe étrangère.';end if;
 if new.campus_id is not null and not exists(select 1 from public.campuses where id=new.campus_id and institution_id=new.institution_id) then raise exception 'Campus étranger.';end if;
 if row(new.campus_id,new.classe_id,new.filiere_id,new.institution_id) is distinct from row(old.campus_id,old.classe_id,old.filiere_id,old.institution_id) and new.campus_id is not null and ((new.filiere_id is not null and exists(select 1 from public.filieres f where f.id=new.filiere_id and f.campus_id is not null and f.campus_id<>new.campus_id)) or (new.classe_id is not null and exists(select 1 from public.classes c where c.id=new.classe_id and c.campus_id is not null and c.campus_id<>new.campus_id))) then raise exception 'La classe et la filière doivent appartenir au campus choisi.';end if;
 if auth.uid() is not null and private.restricted_staff() and new.campus_id is distinct from old.campus_id and not private.staff_campus(new.campus_id) then raise insufficient_privilege;end if;
 return new;
end $$;
