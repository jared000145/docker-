-- Backward-compatible default for clients that omit institution_id on messages.
-- Existing participant and tenant RLS checks remain unchanged.
create function private.default_message_institution() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.institution_id is null then
    select institution_id into new.institution_id from public.profiles where user_id=new.sender_id;
  end if;
  return new;
end $$;
create trigger default_message_institution before insert on public.messages
for each row execute function private.default_message_institution();
create index messages_sender_recent on public.messages(sender_id,created_at desc);
create index messages_recipient_recent on public.messages(recipient_id,created_at desc);
