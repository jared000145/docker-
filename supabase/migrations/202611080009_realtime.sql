-- Supabase provides this publication; the lightweight SQL test engine does not.
do $$ declare target text; begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    foreach target in array array['institution_preregistrations','institution_subscriptions','institutions','profiles','user_roles','team_members','parents','parent_students','grades','grades_trimestre','payments','schedule_events','subjects','notifications','messages','student_years','classes','filieres','enrollments','subject_classes','student_documents'] loop
      if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=target) then
        execute format('alter publication supabase_realtime add table public.%I',target);
      end if;
    end loop;
  end if;
end $$;
