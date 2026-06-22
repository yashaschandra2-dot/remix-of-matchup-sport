
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  city text,
  bio text,
  age int,
  gender text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles_select_own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete to authenticated using (auth.uid() = id);

create table public.user_sports (
  user_id uuid not null references auth.users(id) on delete cascade,
  sport text not null,
  level text not null check (level in ('Beginner','Intermediate','Ace')),
  created_at timestamptz not null default now(),
  primary key (user_id, sport)
);
grant select, insert, update, delete on public.user_sports to authenticated;
grant all on public.user_sports to service_role;
alter table public.user_sports enable row level security;
create policy "user_sports_select_own" on public.user_sports for select to authenticated using (auth.uid() = user_id);
create policy "user_sports_insert_own" on public.user_sports for insert to authenticated with check (auth.uid() = user_id);
create policy "user_sports_update_own" on public.user_sports for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "user_sports_delete_own" on public.user_sports for delete to authenticated using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, city, age, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(new.raw_user_meta_data->>'city', ''), 'Chicago, IL'),
    nullif(new.raw_user_meta_data->>'age', '')::int,
    nullif(new.raw_user_meta_data->>'gender', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Storage policies for avatars bucket (bucket itself is created via tool)
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');
create policy "avatars_owner_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars_owner_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
