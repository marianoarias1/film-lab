begin;
create schema if not exists film_private;
revoke all on schema film_private from public,anon;
grant usage on schema film_private to authenticated;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check(char_length(display_name)<=90),
 created_at timestamptz not null default now()
);
create table public.projects (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 120 and length(btrim(name))>0),
 is_draft boolean not null default false,
 name_key text generated always as (lower(btrim(name))) stored,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(id,owner_id)
);
create unique index projects_owner_name_unique on public.projects(owner_id,name_key);
create index projects_owner_date_idx on public.projects(owner_id,updated_at desc,id desc);
create table public.media_assets (
 id uuid primary key default gen_random_uuid(),project_id uuid not null,owner_id uuid not null,
 filename text not null check(char_length(filename) between 1 and 255),kind text not null check(kind in('photo','video')),
 mime_type text not null,size_bytes bigint not null check(size_bytes>0 and size_bytes<=52428800),
 original_path text not null unique,thumbnail_path text,
 width integer check(width>0),height integer check(height>0),duration numeric check(duration>=0),
 status text not null default 'pending' check(status in('pending','ready')),is_active boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key(project_id,owner_id) references public.projects(id,owner_id) on delete cascade,
 unique(id,owner_id),unique(id,project_id,owner_id),
 check(original_path like owner_id::text||'/'||project_id::text||'/'||id::text||'/%'),
 check(thumbnail_path is null or thumbnail_path like owner_id::text||'/'||project_id::text||'/'||id::text||'/%')
);
create index assets_project_owner_idx on public.media_assets(project_id,owner_id,created_at,id);
create index assets_owner_idx on public.media_assets(owner_id);
create table public.edits (
 asset_id uuid primary key,owner_id uuid not null,
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object' and octet_length(snapshot::text)<65536),
 revision bigint not null default 1 check(revision>0),updated_at timestamptz not null default now(),
 foreign key(asset_id,owner_id) references public.media_assets(id,owner_id) on delete cascade
);
create index edits_owner_idx on public.edits(owner_id);
create table public.recipes (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null check(char_length(client_id) between 1 and 150),
 name text not null check(char_length(name) between 1 and 90),
 payload jsonb not null check(jsonb_typeof(payload)='object' and octet_length(payload::text)<65536),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(owner_id,client_id)
);
create index recipes_owner_date_idx on public.recipes(owner_id,updated_at desc,id desc);
create table public.favorites (
 owner_id uuid not null references auth.users(id) on delete cascade,
 recipe_key text not null check(char_length(recipe_key) between 1 and 150),
 recipe_snapshot jsonb not null check(jsonb_typeof(recipe_snapshot)='object' and octet_length(recipe_snapshot::text)<65536),
 created_at timestamptz not null default now(),primary key(owner_id,recipe_key)
);
create table public.editing_history (
 id uuid primary key default gen_random_uuid(),owner_id uuid not null,project_id uuid not null,asset_id uuid not null,
 filename text not null,action text not null check(action in('import','recipe','adjust','paste','restore','export','remove')),
 before_snapshot jsonb,after_snapshot jsonb not null check(jsonb_typeof(after_snapshot)='object' and octet_length(after_snapshot::text)<65536),
 revision bigint not null,created_at timestamptz not null default now(),
 foreign key(asset_id,project_id,owner_id) references public.media_assets(id,project_id,owner_id) on delete cascade
);
create index history_owner_date_idx on public.editing_history(owner_id,created_at desc,id desc);
create index history_project_date_idx on public.editing_history(project_id,created_at desc,id desc);
create index history_asset_idx on public.editing_history(asset_id);
create index history_asset_project_owner_idx on public.editing_history(asset_id,project_id,owner_id);
create function film_private.touch_updated_at() returns trigger language plpgsql security invoker set search_path='' as $$begin new.updated_at=now();return new;end;$$;
create trigger project_touch before update on public.projects for each row execute function film_private.touch_updated_at();
create trigger recipe_touch before update on public.recipes for each row execute function film_private.touch_updated_at();
-- RPC locks the owner-visible asset, checks optimistic revision, and appends history atomically.
create function public.save_edit(p_asset_id uuid,p_snapshot jsonb,p_expected_revision bigint,p_action text default 'adjust',p_event_id uuid default gen_random_uuid())
returns jsonb language plpgsql security invoker set search_path='' as $$
declare a public.media_assets;previous public.edits;current_revision bigint;v_action text;
begin
 if (select auth.uid()) is null then raise exception 'AUTH_REQUIRED';end if;
 if jsonb_typeof(p_snapshot) <> 'object' or not(p_snapshot ? 'settings') or not(p_snapshot ? 'recipe') or octet_length(p_snapshot::text)>=65536 then raise exception 'INVALID_SNAPSHOT';end if;
 if p_action not in('import','recipe','adjust','paste','restore','export','remove') then raise exception 'INVALID_ACTION';end if;
 select * into a from public.media_assets where id=p_asset_id and owner_id=(select auth.uid()) for update;
 if not found then raise exception 'ASSET_NOT_FOUND';end if;
 if a.status<>'ready' or not exists(select 1 from storage.objects where bucket_id='film-originals' and name=a.original_path) then raise exception 'UPLOAD_PENDING';end if;
 if exists(select 1 from public.editing_history where id=p_event_id and owner_id=(select auth.uid()) and asset_id=p_asset_id) then
  select revision into current_revision from public.editing_history where id=p_event_id;return jsonb_build_object('revision',current_revision,'duplicate',true);
 end if;
 select * into previous from public.edits where asset_id=p_asset_id;
 current_revision=coalesce(previous.revision,0);
 if current_revision<>p_expected_revision then raise exception 'EDIT_CONFLICT';end if;
 if previous.snapshot=p_snapshot and p_action not in('export','remove','restore') then return jsonb_build_object('revision',current_revision,'changed',false);end if;
 v_action=case when current_revision=0 then 'import' else p_action end;
 if p_action='remove' then update public.media_assets set is_active=false where id=p_asset_id;
 elsif p_action='restore' then update public.media_assets set is_active=true where id=p_asset_id;end if;
 insert into public.edits(asset_id,owner_id,snapshot,revision) values(a.id,a.owner_id,p_snapshot,current_revision+1)
 on conflict(asset_id) do update set snapshot=excluded.snapshot,revision=excluded.revision,updated_at=now();
 insert into public.editing_history(id,owner_id,project_id,asset_id,filename,action,before_snapshot,after_snapshot,revision)
 values(p_event_id,a.owner_id,a.project_id,a.id,a.filename,v_action,previous.snapshot,p_snapshot,current_revision+1);
 update public.projects set updated_at=now() where id=a.project_id;
 return jsonb_build_object('revision',current_revision+1,'changed',true);
end;$$;
revoke all on function public.save_edit(uuid,jsonb,bigint,text,uuid) from public,anon;
grant execute on function public.save_edit(uuid,jsonb,bigint,text,uuid) to authenticated;
-- RLS and explicit grants: guest editing never requires these tables.
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select,insert,update,delete on public.profiles to authenticated;
create policy owner_access on public.profiles for all to authenticated using ((select auth.uid())=id) with check ((select auth.uid())=id);
alter table public.projects enable row level security;
revoke all on public.projects from anon;
grant select,insert,update,delete on public.projects to authenticated;
create policy owner_access on public.projects for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
alter table public.media_assets enable row level security;
revoke all on public.media_assets from anon;
grant select,insert,update,delete on public.media_assets to authenticated;
create policy owner_access on public.media_assets for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
alter table public.edits enable row level security;
revoke all on public.edits from anon;
grant select,insert,update,delete on public.edits to authenticated;
create policy owner_access on public.edits for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
alter table public.recipes enable row level security;
revoke all on public.recipes from anon;
grant select,insert,update,delete on public.recipes to authenticated;
create policy owner_access on public.recipes for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
alter table public.favorites enable row level security;
revoke all on public.favorites from anon;
grant select,insert,update,delete on public.favorites to authenticated;
create policy owner_access on public.favorites for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
alter table public.editing_history enable row level security;
revoke all on public.editing_history from anon;
grant select,insert,update,delete on public.editing_history to authenticated;
create policy owner_access on public.editing_history for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);
insert into storage.buckets(id,name,public,file_size_limit) values ('film-originals','film-originals',false,52428800),('film-thumbnails','film-thumbnails',false,2097152);
-- Objects require BOTH the user's prefix and an owner-visible registered asset.
create policy film_read on storage.objects for select to authenticated using (
 (bucket_id='film-originals' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.original_path=name)) or
 (bucket_id='film-thumbnails' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.thumbnail_path=name))
);
create policy film_upload on storage.objects for insert to authenticated with check (
 (storage.foldername(name))[1]=(select auth.uid())::text and (
 (bucket_id='film-originals' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.original_path=name)) or
 (bucket_id='film-thumbnails' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.thumbnail_path=name)))
);
create policy film_update on storage.objects for update to authenticated using (
 (storage.foldername(name))[1]=(select auth.uid())::text and (
 (bucket_id='film-originals' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.original_path=name)) or
 (bucket_id='film-thumbnails' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.thumbnail_path=name)))
) with check (
 (storage.foldername(name))[1]=(select auth.uid())::text and (
 (bucket_id='film-originals' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.original_path=name)) or
 (bucket_id='film-thumbnails' and exists(select 1 from public.media_assets a where a.owner_id=(select auth.uid()) and a.thumbnail_path=name)))
);
-- Owner prefix permits cleanup of uploaded objects even after metadata deletion.
create policy film_delete on storage.objects for delete to authenticated using (bucket_id in('film-originals','film-thumbnails') and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
