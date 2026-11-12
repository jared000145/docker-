-- Institutional references must agree even when a client supplies a forged row.
create function private.check_tenant_references() returns trigger language plpgsql set search_path = '' as $$
declare row_data jsonb := to_jsonb(new); tenant uuid; person uuid; owner_institution uuid; key text;
begin
  tenant := nullif(row_data->>'institution_id','')::uuid;
  if tenant is null then return new; end if;
  foreach key in array array['user_id','student_user_id','professor_user_id'] loop
    person := nullif(row_data->>key,'')::uuid;
    if person is not null then
      select institution_id into owner_institution from public.profiles where user_id=person;
      if owner_institution is distinct from tenant then raise exception 'Institution mismatch for %', key using errcode='23514'; end if;
    end if;
  end loop;
  return new;
end $$;
do $$ declare table_name text; begin
  for table_name in select c.table_name from information_schema.columns c
    where c.table_schema='public' and c.column_name='institution_id' and c.table_name<>'profiles'
    and exists(select 1 from information_schema.columns u where u.table_schema=c.table_schema and u.table_name=c.table_name and u.column_name in ('user_id','student_user_id','professor_user_id'))
  loop execute format('create trigger tenant_references before insert or update on public.%I for each row execute function private.check_tenant_references()', table_name); end loop;
end $$;
alter table public.payments add constraint valid_payment_amounts check (amount>=0 and (paid_amount is null or (paid_amount>=0 and paid_amount<=amount)));
alter table public.grades add constraint valid_grades check ((cc_grade is null or cc_grade between 0 and 20) and (exam_grade is null or exam_grade between 0 and 20) and (average is null or average between 0 and 20));
alter table public.subjects add constraint valid_subject_weights check (credits>=0 and coefficient>0);
alter table public.subjects alter column coefficient set default 1;
alter table public.subjects alter column credits set default 3;
alter table public.payments alter column status set default 'pending';
alter table public.payments alter column paid_amount set default 0;
