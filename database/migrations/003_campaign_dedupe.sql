alter table campaigns
  add column if not exists dedupe_key text;

create unique index if not exists campaigns_dedupe_key_unique
  on campaigns(dedupe_key)
  where dedupe_key is not null;
