-- Odak Ajandası — Supabase tablosu ve erişim kuralları
-- Supabase panelinde: SQL Editor -> bu dosyanın tamamını çalıştırın.
-- Uygulamadaki anonKey herkese açıktır; verinin güvenliği AŞAĞIDAKİ RLS
-- kurallarına dayanır. Bu kurallar yoksa herkes herkesin satırını okuyabilir.

create table if not exists public.user_state (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  tasks              jsonb not null default '[]'::jsonb,
  focus_history      jsonb not null default '[]'::jsonb,
  inbox              jsonb not null default '[]'::jsonb,
  daily_notes        jsonb not null default '{}'::jsonb,
  streak_days        integer,
  daily_goal_minutes integer,
  friends_list       jsonb
);

-- Not: friends_list sütunu eski sürümden kalmıştır, uygulama artık yazmıyor.

-- Kaba boyut ve tip sınırları (uygulama tarafındaki doğrulamaya ek olarak)
alter table public.user_state drop constraint if exists user_state_sizes;
alter table public.user_state add constraint user_state_sizes check (
  jsonb_typeof(tasks) = 'array'
  and jsonb_typeof(focus_history) = 'array'
  and jsonb_typeof(inbox) = 'array'
  and jsonb_typeof(daily_notes) = 'object'
  and pg_column_size(tasks) < 2000000
  and pg_column_size(focus_history) < 2000000
  and pg_column_size(inbox) < 500000
  and pg_column_size(daily_notes) < 500000
  and (daily_goal_minutes is null or daily_goal_minutes between 15 and 1440)
);

alter table public.user_state enable row level security;

drop policy if exists "own row select" on public.user_state;
drop policy if exists "own row insert" on public.user_state;
drop policy if exists "own row update" on public.user_state;
drop policy if exists "own row delete" on public.user_state;

create policy "own row select" on public.user_state
  for select using (auth.uid() = user_id);
create policy "own row insert" on public.user_state
  for insert with check (auth.uid() = user_id);
create policy "own row update" on public.user_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own row delete" on public.user_state
  for delete using (auth.uid() = user_id);

-- Kontrol: aşağıdaki sorgu "true" dönmeli
-- select relrowsecurity from pg_class where relname = 'user_state';
