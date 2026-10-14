-- Already applied to the connected project. Patch for older installations only.
alter table public.projects add column is_draft boolean not null default false;
