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

-- ─── v2 : programme complet (tampons, cashback, niveaux, anniversaire, parrainage) ───

create table if not exists program_settings (
  id         integer primary key default 1 check (id = 1),
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table customers add column if not exists birthdate date;
alter table customers add column if not exists stamps integer not null default 0;
alter table customers add column if not exists cashback_cents integer not null default 0;
alter table customers add column if not exists last_birthday_year integer;
alter table customers add column if not exists referred_by integer references customers(id) on delete set null;

alter table transactions add column if not exists stamps integer not null default 0;
alter table transactions add column if not exists cashback_cents integer not null default 0;
alter table transactions drop constraint if exists transactions_type_check;
alter table transactions add constraint transactions_type_check check (type in (
  'earn', 'redeem', 'bonus', 'import', 'adjust', 'welcome', 'birthday', 'referral', 'stamp_reward', 'cashback_use'
));

-- ─── v3 : tableau de bord (origine des inscriptions, appareil) ───
alter table customers add column if not exists signup_source text;
alter table customers add column if not exists signup_device text;
create index if not exists transactions_created_idx on transactions (created_at desc);
create index if not exists customers_created_idx on customers (created_at desc);

-- ─── v4 : codes promo (1 achetée = 1 offerte, remises, produit offert, tampons bonus…) ───
create table if not exists coupons (
  id                serial primary key,
  code              text unique not null,
  title             text not null,
  kind              text not null check (kind in ('bogo', 'percent', 'amount', 'free_item', 'stamps', 'custom')),
  value             numeric(8, 2) not null default 0,
  buy_qty           integer not null default 1,
  get_qty           integer not null default 1,
  item              text not null default 'pizza',
  min_amount        numeric(8, 2) not null default 0,
  conditions        text,
  once_per_customer boolean not null default true,
  max_uses          integer,
  uses              integer not null default 0,
  valid_days        integer[],               -- 1 = lundi … 7 = dimanche ; null = tous les jours
  starts_at         timestamptz not null default now(),
  ends_at           timestamptz,
  active            boolean not null default true,
  show_in_app       boolean not null default true,
  created_at        timestamptz not null default now()
);

create table if not exists coupon_redemptions (
  id          serial primary key,
  coupon_id   integer not null references coupons(id) on delete cascade,
  customer_id integer references customers(id) on delete set null,
  staff_id    integer references customers(id) on delete set null,
  -- renseigné uniquement pour les codes « 1 utilisation par client » : garantit l'unicité même en cas de double clic
  once_key    text unique,
  created_at  timestamptz not null default now()
);
create index if not exists coupon_redemptions_customer_idx on coupon_redemptions (customer_id);

-- ─── v5 : anciens clients importés = vrais comptes « en attente d'inscription » ───
-- Visibles dans l'admin et au scanner dès l'import ; l'inscription avec le même e-mail active le compte.
alter table customers add column if not exists pending boolean not null default false;
