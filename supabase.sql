drop table if exists public.interviews cascade;

create extension if not exists pgcrypto;

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  full_name text not null,
  phone text not null,
  role text not null check (role in ('Soldador','Armador','Labores generales')),
  source text,
  experience text,
  interview_date date not null,
  time_slot text not null,
  status text not null default 'Confirmada',
  unique(interview_date, time_slot)
);

alter table public.interviews enable row level security;

create policy "public can book"
on public.interviews for insert
to anon
with check (
  interview_date >= current_date
  and extract(isodow from interview_date) between 1 and 5
  and time_slot in ('9:00 AM','9:30 AM','10:00 AM','10:30 AM','11:00 AM','1:00 PM','1:30 PM','2:00 PM','2:30 PM')
);

create policy "authenticated admins can read"
on public.interviews for select
to authenticated
using (true);

create policy "authenticated admins can update"
on public.interviews for update
to authenticated
using (true)
with check (true);

create policy "authenticated admins can delete"
on public.interviews for delete
to authenticated
using (true);

create or replace function public.get_booked_slots(p_date date)
returns table(time_slot text)
language sql
security definer
set search_path = public
as $$
  select i.time_slot from public.interviews i where i.interview_date = p_date and i.status = 'Confirmada';
$$;

grant execute on function public.get_booked_slots(date) to anon, authenticated;
