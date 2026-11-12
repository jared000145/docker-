create table public.registration_number_counters(prefix text primary key,last_value bigint not null);
create table public.registration_number_reservations(request_key text primary key,institution_id uuid not null references public.institutions(id) on delete cascade,number text not null unique,created_at timestamptz not null default now());
alter table public.registration_number_counters enable row level security;
alter table public.registration_number_reservations enable row level security;
grant all on public.registration_number_counters,public.registration_number_reservations to service_role;
create function public.reserve_registration_number(_institution uuid,_prefix text,_initials text,_key text) returns text language plpgsql security definer set search_path='' as $$
declare base text;sequence bigint;result text;tenant uuid;
begin
 if _prefix !~ '^[A-Z0-9]{1,12}$' or _initials !~ '^[A-Z0-9]{1,12}$' or length(_key) not between 10 and 250 or not exists(select 1 from public.institutions where id=_institution) then raise exception 'Référence de matricule invalide.';end if;
 select number,institution_id into result,tenant from public.registration_number_reservations where request_key=_key;
 if found then if tenant<>_institution then raise insufficient_privilege;end if;return result;end if;
 base:=_prefix||'-'||_initials||'-'||extract(year from now() at time zone 'Europe/Paris')::int;
 loop
  insert into public.registration_number_counters(prefix,last_value)values(base,1)on conflict(prefix)do update set last_value=registration_number_counters.last_value+1 returning last_value into sequence;
  result:=base||'-'||lpad(sequence::text,greatest(4,length(sequence::text)), '0');
  exit when not exists(select 1 from public.profiles where upper(student_number)=result) and not exists(select 1 from public.registration_number_reservations where number=result);
 end loop;
 insert into public.registration_number_reservations(request_key,institution_id,number)values(_key,_institution,result)on conflict(request_key)do update set request_key=excluded.request_key returning number,institution_id into result,tenant;
 if tenant<>_institution then raise insufficient_privilege;end if;return result;
end $$;
revoke all on function public.reserve_registration_number(uuid,text,text,text) from public;
grant execute on function public.reserve_registration_number(uuid,text,text,text) to service_role;
