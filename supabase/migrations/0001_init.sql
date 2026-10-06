-- Phase 2: swap src/server/store.ts (in-memory) for queries against these
-- tables. Shapes mirror PlayerRecord / TableState / SeatState / HandState in
-- src/lib/types.ts and src/server/store.ts so the swap touches one file.

create table players (
  id uuid primary key default gen_random_uuid(),
  pseudo text not null,
  device_token text not null unique,
  balance integer not null default 3000,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  total_wins integer not null default 0,
  total_losses integer not null default 0,
  total_blackjacks integer not null default 0,
  last_bonus_at timestamptz not null default now()
);

create table bonus_credits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players (id) on delete cascade,
  amount integer not null,
  credited_at timestamptz not null default now()
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'idle',
  created_at timestamptz not null default now(),
  dealer_state jsonb not null default '{}',
  current_round integer not null default 0,
  shoe_state jsonb not null default '{}'
);

create table seats (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables (id) on delete cascade,
  seat_number integer not null check (seat_number between 1 and 8),
  player_id uuid references players (id) on delete set null,
  bet integer not null default 0,
  status text not null default 'empty',
  unique (table_id, seat_number)
);

create table rounds (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references tables (id) on delete cascade,
  round_number integer not null,
  status text not null default 'idle',
  dealer_hand jsonb not null default '[]',
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table hands (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references rounds (id) on delete cascade,
  player_id uuid references players (id) on delete set null,
  seat_number integer not null,
  cards jsonb not null default '[]',
  bet integer not null,
  result text,
  payout integer not null default 0,
  status text not null default 'active'
);

create index on bonus_credits (player_id);
create index on seats (table_id);
create index on rounds (table_id);
create index on hands (round_id);
