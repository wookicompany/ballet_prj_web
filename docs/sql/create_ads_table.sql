-- 광고 관리 테이블 (B2B 우선 출시 + 공급자 확장 가능)
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('calendar_home', 'performance_home')),
  provider text not null default 'b2b' check (provider in ('b2b', 'adsense')),
  title text not null,
  description text null,
  image_url text not null,
  target_url text not null,
  is_active boolean not null default false,
  start_at timestamptz not null,
  end_at timestamptz not null,
  click_count integer not null default 0 check (click_count >= 0),
  last_clicked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_start_end_check check (start_at < end_at)
);

create index if not exists ads_placement_active_idx
  on public.ads (placement, is_active, start_at, end_at);

create index if not exists ads_active_time_idx
  on public.ads (is_active, start_at, end_at);
-- 광고 관리 테이블 (B2B 우선 출시 + 공급자 확장 가능)
create table if not exists public.ads (
  id uuid primary key default gen_random_uuid(),
  placement text not null check (placement in ('calendar_home', 'performance_home')),
  provider text not null default 'b2b' check (provider in ('b2b', 'adsense')),
  title text not null,
  description text null,
  image_url text not null,
  target_url text not null,
  is_active boolean not null default false,
  start_at timestamptz not null,
  end_at timestamptz not null,
  click_count integer not null default 0 check (click_count >= 0),
  last_clicked_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ads_start_end_check check (start_at < end_at)
);

create index if not exists ads_placement_active_idx
  on public.ads (placement, is_active, start_at, end_at);

create index if not exists ads_active_time_idx
  on public.ads (is_active, start_at, end_at);
