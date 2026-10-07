alter table campaigns
  drop constraint if exists campaigns_status_check;

alter table campaigns
  add constraint campaigns_status_check
  check (status in ('draft','scheduled','sending','sent'));
