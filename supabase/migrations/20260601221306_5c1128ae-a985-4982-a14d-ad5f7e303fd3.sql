
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "profiles read own" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "profiles insert own" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "profiles update own" on public.profiles for update to authenticated using (auth.uid() = id);

-- Documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_user_updated_idx on public.documents(user_id, updated_at desc);
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;
alter table public.documents enable row level security;
create policy "docs select own" on public.documents for select to authenticated using (auth.uid() = user_id);
create policy "docs insert own" on public.documents for insert to authenticated with check (auth.uid() = user_id);
create policy "docs update own" on public.documents for update to authenticated using (auth.uid() = user_id);
create policy "docs delete own" on public.documents for delete to authenticated using (auth.uid() = user_id);

-- Versions
create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  word_count integer not null default 0,
  label text,
  created_at timestamptz not null default now()
);
create index versions_doc_created_idx on public.document_versions(document_id, created_at desc);
grant select, insert, delete on public.document_versions to authenticated;
grant all on public.document_versions to service_role;
alter table public.document_versions enable row level security;
create policy "versions select own" on public.document_versions for select to authenticated using (auth.uid() = user_id);
create policy "versions insert own" on public.document_versions for insert to authenticated with check (auth.uid() = user_id);
create policy "versions delete own" on public.document_versions for delete to authenticated using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
