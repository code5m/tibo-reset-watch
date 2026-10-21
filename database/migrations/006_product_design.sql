begin;
create table if not exists product_profiles (
  id uuid primary key, secret_hash char(64) not null unique,
  display_name varchar(80) not null, data jsonb not null,
  version integer not null default 1, created_at timestamptz not null default now()
);
create table if not exists product_workspaces (
  id uuid primary key, owner_id uuid not null references product_profiles(id),
  name varchar(100) not null, data jsonb not null, version integer not null default 1,
  created_at timestamptz not null default now()
);
create table if not exists product_members (
  workspace_id uuid not null references product_workspaces(id) on delete cascade,
  profile_id uuid not null references product_profiles(id) on delete cascade,
  role text not null check(role in ('viewer','editor')),
  primary key(workspace_id, profile_id)
);
create table if not exists product_invites (
  token_hash char(64) primary key, workspace_id uuid not null references product_workspaces(id) on delete cascade,
  role text not null check(role in ('viewer','editor')), expires_at timestamptz not null, used_at timestamptz
);
create table if not exists product_devices (
  id uuid primary key, profile_id uuid not null references product_profiles(id) on delete cascade,
  kind text not null check(kind in ('uni-push','wechat')), token_hash char(64) not null unique,
  encrypted_target text not null, consent_at timestamptz not null,
  revoked_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists product_deliveries (
  id uuid primary key, profile_id uuid not null references product_profiles(id) on delete cascade,
  event_id varchar(100) not null, phase varchar(40) not null, source_post_id varchar(100) not null,
  device_id uuid references product_devices(id) on delete set null,
  target_key text not null default 'in_app',
  channel text not null check(channel in ('in_app','native')), payload jsonb not null,
  status text not null check(status in ('queued','processing','available','accepted','failed','unknown','cancelled')),
  provider_id varchar(200), error_code varchar(100), attempts integer not null default 0,
  occurred_at timestamptz not null, queued_at timestamptz not null default now(),
  attempted_at timestamptz, accepted_at timestamptz, received_at timestamptz, opened_at timestamptz,
  unique(profile_id,event_id,phase,channel,target_key)
);
create index if not exists product_delivery_queue on product_deliveries(status,queued_at);
create table if not exists product_audit (
  id bigserial primary key, actor_id text not null, action text not null,
  resource_id text, metadata jsonb not null default '{}', created_at timestamptz not null default now()
);
create table if not exists product_drafts (
  id uuid primary key, event_id varchar(100) not null, kind text not null check(kind in ('alert','social')),
  body text not null, version integer not null default 1,
  status text not null default 'draft' check(status in ('draft','externally_published')),
  external_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists product_rate_limits (
  bucket text primary key, window_start timestamptz not null, hits integer not null
);
commit;
