create extension if not exists pgcrypto;

alter table subscribers
  add column if not exists referral_code text;

update subscribers
   set referral_code = upper(encode(gen_random_bytes(5), 'hex'))
 where referral_code is null;

alter table subscribers
  alter column referral_code set default upper(encode(gen_random_bytes(5), 'hex'));

alter table subscribers
  alter column referral_code set not null;

alter table subscribers
  add column if not exists sms_credits integer not null default 0;

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

create index if not exists referrals_inviter_created_idx
  on referrals(inviter_id, created_at desc);

create index if not exists referrals_status_created_idx
  on referrals(status, created_at desc);

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

create index if not exists reward_ledger_subscriber_created_idx
  on reward_ledger(subscriber_id, created_at desc);

insert into app_settings(key, value)
values (
  'referrals',
  '{"smsCreditsPerQualifiedReferral":3,"monthlySmsCreditCap":30,"qualificationMode":"verified-subscriber","shareReward":false}'::jsonb
)
on conflict (key) do nothing;
