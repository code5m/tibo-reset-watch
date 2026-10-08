create extension if not exists pgcrypto;

create table if not exists subscribers (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  wechat_target text,
  alipay_target text,
  name text,
  status text not null default 'active' check (status in ('active','pending','unsubscribed')),
  channels jsonb not null default '[]'::jsonb,
  interests jsonb not null default '["reset"]'::jsonb,
  source text not null default 'website',
  referral_code text not null default upper(encode(gen_random_bytes(5), 'hex')),
  sms_credits integer not null default 0 check (sms_credits >= 0),
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email is not null or phone is not null or wechat_target is not null or alipay_target is not null)
);

create unique index if not exists subscribers_email_unique
  on subscribers (lower(email)) where email is not null;

create unique index if not exists subscribers_phone_unique
  on subscribers (phone) where phone is not null;

create unique index if not exists subscribers_referral_code_unique
  on subscribers(lower(referral_code));

create table if not exists referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references subscribers(id) on delete cascade,
  invitee_id uuid not null references subscribers(id) on delete cascade,
  referral_code text not null,
  status text not null default 'pending' check (status in ('pending','qualified','rejected')),
  source text not null default 'web',
  qualified_at timestamptz,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (inviter_id <> invitee_id),
  unique (invitee_id)
);

create index if not exists referrals_inviter_created_idx on referrals(inviter_id, created_at desc);
create index if not exists referrals_status_created_idx on referrals(status, created_at desc);

create table if not exists reward_ledger (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  referral_id uuid references referrals(id) on delete set null,
  reward_type text not null default 'sms_credit' check (reward_type in ('sms_credit')),
  delta integer not null check (delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text not null,
  idempotency_key text,
  created_at timestamptz not null default now()
);

create unique index if not exists reward_ledger_idempotency_unique
  on reward_ledger(idempotency_key) where idempotency_key is not null;
create index if not exists reward_ledger_subscriber_created_idx on reward_ledger(subscriber_id, created_at desc);

create table if not exists signals (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tibo-x',
  source_post_id text not null,
  kind text not null check (kind in ('completed','scheduled','banked','hint')),
  title text not null,
  body text not null,
  source_url text not null,
  source_created_at timestamptz not null,
  reset_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source, source_post_id, kind)
);

create index if not exists signals_created_at_idx on signals (created_at desc);
create index if not exists signals_reset_at_idx on signals (reset_at desc);

create table if not exists project_leads (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tibo-x',
  source_post_id text not null unique,
  title text not null,
  summary text not null,
  source_url text not null,
  score integer not null default 0,
  tags jsonb not null default '[]'::jsonb,
  source_created_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists content_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null default '',
  body text not null default '',
  content_type text not null default 'article' check (content_type in ('article','update','guide')),
  status text not null default 'draft' check (status in ('draft','published')),
  seo_title text,
  seo_description text,
  geo_summary text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists content_status_idx on content_items(status, published_at desc);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  audience text not null default 'all',
  channels jsonb not null default '["email"]'::jsonb,
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent')),
  scheduled_at timestamptz,
  sent_at timestamptz,
  dedupe_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists campaigns_dedupe_key_unique
  on campaigns(dedupe_key) where dedupe_key is not null;

create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete set null,
  subscriber_id uuid references subscribers(id) on delete set null,
  channel text not null,
  provider text not null,
  status text not null check (status in ('queued','sent','failed','skipped')),
  provider_message_id text,
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists deliveries_campaign_idx on deliveries(campaign_id, created_at desc);

create table if not exists events (
  id bigserial primary key,
  event_name text not null,
  anonymous_id text,
  path text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists events_name_created_idx on events(event_name, created_at desc);

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings(key, value)
values
  ('brand', '{"name":"ResetWatch","locale":"zh-CN"}'::jsonb),
  ('distribution', '{"projectDigestHourCN":20,"resetImmediate":true}'::jsonb),
  ('referrals', '{"smsCreditsPerQualifiedReferral":3,"monthlySmsCreditCap":30,"qualificationMode":"verified-subscriber","shareReward":false}'::jsonb)
on conflict (key) do nothing;
