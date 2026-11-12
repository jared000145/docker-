-- Principal settings previously returned zero updated rows because only super admins had an update policy.
create policy principal_settings_update on public.institutions for update to authenticated using(id=private.institution_id() and private.is_admin()) with check(id=private.institution_id() and private.is_admin());
create function private.protect_institution_settings() returns trigger language plpgsql security definer set search_path='' as $$
declare allowed text[]:=array['name','slogan','description','address','email','phone','primary_color','secondary_color','accent_color','domain','institution_type','academic_year','code','credits_min_passage','credits_max_passage','credits_total_annee','cycle','is_multi_campus','accepts_applications','admission_contact','logo_url','cover_image_url','payment_config','enabled_cycles','exam_blanc_enabled','exam_blanc_types','quota_absence_hours_annuel','pass_threshold','updated_at','end_of_year_completed'];
begin
 if auth.uid() is null or private.is_super() then return new;end if;
 if not private.is_admin() or old.id<>private.institution_id() or (to_jsonb(new)-allowed) is distinct from (to_jsonb(old)-allowed) then raise insufficient_privilege;end if;
 if new.academic_year is distinct from old.academic_year then
  if new.academic_year !~ '^\d{4}-\d{4}$' or split_part(new.academic_year,'-',2)::int<>split_part(new.academic_year,'-',1)::int+1 then raise exception 'Année scolaire invalide.';end if;
  if old.academic_year ~ '^\d{4}-\d{4}$' and split_part(new.academic_year,'-',1)::int<>split_part(old.academic_year,'-',1)::int+1 then raise exception 'Basculez vers l’année suivante uniquement.';end if;
 end if;
 return new;
end $$;
create trigger protect_institution_settings before update on public.institutions for each row execute function private.protect_institution_settings();
