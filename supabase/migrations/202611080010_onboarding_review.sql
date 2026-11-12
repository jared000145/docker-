alter table private.intake_sessions add column document_review jsonb;
alter table private.intake_sessions add column review_attempts integer not null default 0;
alter table private.intake_sessions add column review_lease_until timestamptz;
alter table public.institution_preregistrations add column document_review jsonb;

create function public.claim_intake_review(_id uuid,_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare intake private.intake_sessions;
begin
 select * into intake from private.intake_sessions where id=_id and token_hash=_token_hash for update;
 if not found or intake.expires_at<now() then raise exception 'Session de dépôt invalide ou expirée.'; end if;
 if intake.submitted_id is not null then return jsonb_build_object('submitted_id',intake.submitted_id); end if;
 if intake.document_review->>'status'='ready' then return jsonb_build_object('review',intake.document_review); end if;
 if intake.review_lease_until>now() then raise exception 'Analyse déjà en cours. Patientez avant de réessayer.'; end if;
 if intake.review_attempts>=3 then raise exception 'Limite des analyses atteinte. Recommencez le dépôt.'; end if;
 update private.intake_sessions set review_attempts=review_attempts+1,review_lease_until=now()+interval '2 minutes' where id=_id;
 return jsonb_build_object('paths',intake.paths,'payload',intake.payload);
end $$;
create function public.finish_intake_review(_id uuid,_token_hash text,_review jsonb) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.intake_sessions set document_review=_review,review_lease_until=null where id=_id and token_hash=_token_hash;
 if not found then raise exception 'Session de dépôt introuvable.'; end if;
end $$;
alter function public.submit_preregistration(uuid,text) rename to submit_preregistration_unverified;
revoke all on function public.submit_preregistration_unverified(uuid,text) from public,anon,authenticated,service_role;
create function public.submit_preregistration(_id uuid,_token_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare review jsonb; result uuid;
begin
 select document_review into review from private.intake_sessions where id=_id and token_hash=_token_hash for update;
 if not found or review->>'status' is distinct from 'ready' then raise exception 'Les documents doivent passer le contrôle préalable.'; end if;
 result:=public.submit_preregistration_unverified(_id,_token_hash);
 update public.institution_preregistrations set document_review=review where id=result;
 return result;
end $$;
revoke all on function public.claim_intake_review(uuid,text),public.finish_intake_review(uuid,text,jsonb),public.submit_preregistration(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_intake_review(uuid,text),public.finish_intake_review(uuid,text,jsonb),public.submit_preregistration(uuid,text) to service_role;

create function private.require_document_review() returns trigger language plpgsql set search_path='' as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' and new.document_review->>'status' is distinct from 'ready' then raise exception 'Analyse des documents requise avant validation.'; end if;
 return new;
end $$;
create trigger preregistration_review_guard before update on public.institution_preregistrations for each row execute function private.require_document_review();

create table public.preregistration_emails (
 id uuid primary key default gen_random_uuid(), request_id uuid not null references public.institution_preregistrations(id) on delete cascade,
 kind text not null check(kind in ('received','approved','rejected')), status text not null default 'queued' check(status in ('queued','sending','sent','failed')),
 attempts integer not null default 0, available_at timestamptz not null default now(), provider_id text, last_error text,
 created_at timestamptz not null default now(), sent_at timestamptz, unique(request_id,kind)
);
alter table public.preregistration_emails enable row level security;
grant select on public.preregistration_emails to authenticated;
create policy super_read on public.preregistration_emails for select to authenticated using(private.is_super());
grant all on public.preregistration_emails to service_role;
create function private.queue_preregistration_email() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  insert into public.preregistration_emails(request_id,kind) values(new.id,'received') on conflict do nothing;
 elsif new.status is distinct from old.status and new.status in ('approved','rejected') then
  insert into public.preregistration_emails(request_id,kind) values(new.id,new.status) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger preregistration_email_queue after insert or update on public.institution_preregistrations for each row execute function private.queue_preregistration_email();
create function public.claim_preregistration_emails(_request_id uuid) returns setof public.preregistration_emails language sql security definer set search_path='' as $$
 update public.preregistration_emails set status='sending',attempts=attempts+1,available_at=now()+interval '10 minutes'
 where id in (select id from public.preregistration_emails where request_id=_request_id and status<>'sent' and available_at<=now() and attempts<5 order by created_at limit 3 for update skip locked) returning *
$$;
revoke all on function public.claim_preregistration_emails(uuid) from public,anon,authenticated;
grant execute on function public.claim_preregistration_emails(uuid) to service_role;
