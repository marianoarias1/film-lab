-- Already applied to the connected Film Lab project (film_lab_unique_project_names).
-- Existing duplicates were preserved and renamed with (2), (3), etc.
-- Patch for a v4.0 installation only, after resolving duplicate names.
-- The updated foundation already includes this; do not apply twice.
alter table public.projects add column name_key text generated always as (lower(btrim(name))) stored;
create unique index projects_owner_name_unique on public.projects(owner_id,name_key);
alter table public.projects add constraint projects_name_not_blank check (length(btrim(name))>0);
