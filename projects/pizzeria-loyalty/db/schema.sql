-- Schéma du programme de fidélité (idempotent : peut être relancé sans risque)

create table if not exists signup_codes (
  id            serial primary key,
  code          text unique not null,
  bonus_points  integer not null default 0,
  max_uses      integer,
  uses          integer not null default 0,
  expires_at    timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists customers (
  id               serial primary key,
  email            text unique not null,
  name             text not null,
  phone            text,
  password_hash    text not null,
  role             text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  card_code        text unique not null,
  points           integer not null default 0,
  lifetime_points  integer not null default 0,
  signup_code_id   integer references signup_codes(id) on delete set null,
  last_visit_at    timestamptz,
  last_reminder_at timestamptz,
  created_at       timestamptz not null default now()
);

-- Clients de l'ancienne carte importés par CSV : leurs points sont
-- rattachés automatiquement au compte créé avec la même adresse e-mail.
create table if not exists legacy_customers (
  email       text primary key,
  name        text,
  phone       text,
  points      integer not null default 0,
  imported_at timestamptz not null default now(),
  claimed_by  integer references customers(id) on delete set null,
  claimed_at  timestamptz
);

create table if not exists promotions (
  id          serial primary key,
  title       text not null,
  message     text,
  multiplier  numeric(4, 2) not null default 2,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  active      boolean not null default true,
  notified_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists rewards (
  id         serial primary key,
  name       text not null,
  cost       integer not null check (cost > 0),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists transactions (
  id           serial primary key,
  customer_id  integer not null references customers(id) on delete cascade,
  type         text not null check (type in ('earn', 'redeem', 'bonus', 'import', 'adjust')),
  points       integer not null,
  amount_cents integer,
  multiplier   numeric(4, 2),
  promotion_id integer references promotions(id) on delete set null,
  reward_id    integer references rewards(id) on delete set null,
  staff_id     integer references customers(id) on delete set null,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists transactions_customer_idx on transactions (customer_id, created_at desc);

create table if not exists push_subscriptions (
  id          serial primary key,
  customer_id integer not null references customers(id) on delete cascade,
  endpoint    text unique not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists notifications_log (
  id         serial primary key,
  title      text not null,
  body       text not null,
  audience   text not null,
  sent       integer not null default 0,
  created_at timestamptz not null default now()
);

-- Récompenses par défaut (uniquement si la table est vide)
insert into rewards (name, cost)
select * from (values ('Boisson offerte', 50), ('Dessert offert', 80), ('Pizza offerte', 120)) as v(name, cost)
where not exists (select 1 from rewards);
