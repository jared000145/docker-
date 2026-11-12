-- Store the campus of each new operational record, rather than guessing at read time.
create function private.fill_record_campus() returns trigger language plpgsql security definer set search_path='' as $$
declare data jsonb:=to_jsonb(new); ref_campus uuid; ref_tenant uuid; key text; target text; reference uuid;
begin
 foreach key in array array['user_id','classe_id','filiere_id','subject_id','classroom_id'] loop
  reference:=nullif(data->>key,'')::uuid;if reference is null then continue;end if;
  target:=case key when 'user_id' then 'profiles' when 'classe_id' then 'classes' when 'filiere_id' then 'filieres' when 'subject_id' then 'subjects' when 'classroom_id' then 'classrooms' end;
  execute format('select institution_id,campus_id from public.%I where %I=$1',target,case key when 'user_id' then 'user_id' else 'id' end) into ref_tenant,ref_campus using reference;
  if ref_tenant is distinct from new.institution_id then raise exception 'Institution mismatch for %',key;end if;
  if new.campus_id is null then new.campus_id:=ref_campus;
  elsif ref_campus is not null and ref_campus<>new.campus_id and not private.is_super() and (tg_op='INSERT' or new.campus_id is distinct from old.campus_id) then raise exception 'Campus incompatible avec %.',key;end if;
 end loop;
 if new.campus_id is not null and not exists(select 1 from public.campuses where id=new.campus_id and institution_id=new.institution_id) then raise exception 'Campus étranger.';end if;
 return new;
end $$;
do $$declare t text;begin
 foreach t in array array['grades','payments','attendance','schedule_events','subjects','classes'] loop
  execute format('create trigger fill_record_campus before insert or update on public.%I for each row execute function private.fill_record_campus()',t);
 end loop;
end $$;
