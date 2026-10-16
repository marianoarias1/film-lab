-- Server-enforced cloud budget. Apply once after film_lab_cloud.sql.
-- Pending uploads reserve a full bucket-sized slot, regardless of client-declared bytes.
-- This prevents understated sizes and parallel uploads from exceeding the budget.
begin;
create table film_private.cloud_quotas (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 limit_bytes bigint not null default 1073741824 check(limit_bytes>=0),
 used_bytes bigint not null default 0 check(used_bytes>=0),
 reserved_bytes bigint not null default 0 check(reserved_bytes>=0),
 asset_count integer not null default 0 check(asset_count>=0),
 project_count integer not null default 0 check(project_count>=0),
 max_assets integer not null default 1000 check(max_assets>=0),
 max_projects integer not null default 100 check(max_projects>=0)
);
alter table film_private.cloud_quotas enable row level security;
revoke all on film_private.cloud_quotas from public,anon,authenticated;
alter table public.media_assets add column cloud_charge_bytes bigint not null default 0;
-- Initialize without changing or deleting existing originals.
update public.media_assets a set cloud_charge_bytes=case when a.status='pending' then 54525952 else
 coalesce((select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id='film-originals' and o.name=a.original_path),a.size_bytes)
 +coalesce((select (o.metadata->>'size')::bigint from storage.objects o where o.bucket_id='film-thumbnails' and o.name=a.thumbnail_path),0) end;
insert into film_private.cloud_quotas(owner_id,used_bytes,reserved_bytes,asset_count,project_count)
select u.id,coalesce(sum(a.cloud_charge_bytes) filter(where a.status='ready'),0),coalesce(sum(a.cloud_charge_bytes) filter(where a.status='pending'),0),count(a.id),(select count(*) from public.projects p where p.owner_id=u.id)
from auth.users u left join public.media_assets a on a.owner_id=u.id group by u.id;
create index assets_thumbnail_path_idx on public.media_assets(thumbnail_path) where thumbnail_path is not null;

create function film_private.prepare_cloud_asset() returns trigger language plpgsql security definer set search_path='' as $$
declare actual_bytes bigint;thumb_bytes bigint;
begin
 if auth.uid() is not null and auth.uid()<>coalesce(new.owner_id,old.owner_id) then raise exception 'AUTH_REQUIRED';end if;
 if tg_op='DELETE' then
  if exists(select 1 from storage.objects where (bucket_id='film-originals' and name=old.original_path) or (bucket_id='film-thumbnails' and name=old.thumbnail_path)) then raise exception 'DELETE_CLOUD_FILES_FIRST';end if;
  return old;
 end if;
 if tg_op='UPDATE' and (new.id<>old.id or new.owner_id<>old.owner_id or new.project_id<>old.project_id or new.original_path<>old.original_path or new.size_bytes<>old.size_bytes or (old.thumbnail_path is not null and new.thumbnail_path is distinct from old.thumbnail_path)) then raise exception 'CLOUD_ASSET_IMMUTABLE';end if;
 if new.status='pending' then new.cloud_charge_bytes:=54525952;
 else
  select (metadata->>'size')::bigint into actual_bytes from storage.objects where bucket_id='film-originals' and name=new.original_path;
  if actual_bytes is null then raise exception 'UPLOAD_PENDING';end if;
  if actual_bytes<>new.size_bytes then raise exception 'CLOUD_FILE_SIZE_MISMATCH';end if;
  thumb_bytes:=0;
  if new.thumbnail_path is not null then
   select (metadata->>'size')::bigint into thumb_bytes from storage.objects where bucket_id='film-thumbnails' and name=new.thumbnail_path;
   if thumb_bytes is null then raise exception 'UPLOAD_PENDING';end if;
  end if;
  new.cloud_charge_bytes:=actual_bytes+thumb_bytes;
 end if;
 return new;
end;$$;
create trigger cloud_asset_prepare before insert or update or delete on public.media_assets for each row execute function film_private.prepare_cloud_asset();

create function film_private.account_cloud_change() returns trigger language plpgsql security definer set search_path='' as $$
declare uid uuid;du bigint:=0;dr bigint:=0;da integer:=0;dp integer:=0;q film_private.cloud_quotas;
begin
 uid:=case when tg_op='DELETE' then old.owner_id else new.owner_id end;
 if auth.uid() is not null and auth.uid()<>uid then raise exception 'AUTH_REQUIRED';end if;
 if tg_table_name='projects' then
  if tg_op='UPDATE' and (new.id<>old.id or new.owner_id<>old.owner_id) then raise exception 'CLOUD_ASSET_IMMUTABLE';end if;
  dp:=case when tg_op='INSERT' then 1 when tg_op='DELETE' then -1 else 0 end;
 else
  if tg_op<>'INSERT' then
   if old.status='ready' then du:=du-old.cloud_charge_bytes;else dr:=dr-old.cloud_charge_bytes;end if;
   da:=da-1;
  end if;
  if tg_op<>'DELETE' then
   if new.status='ready' then du:=du+new.cloud_charge_bytes;else dr:=dr+new.cloud_charge_bytes;end if;
   da:=da+1;
  end if;
 end if;
 if du=0 and dr=0 and da=0 and dp=0 then return null;end if;
 insert into film_private.cloud_quotas(owner_id) values(uid) on conflict do nothing;
 -- A single atomic UPDATE serializes reservations from all tabs/devices for this account.
 update film_private.cloud_quotas set used_bytes=used_bytes+du,reserved_bytes=reserved_bytes+dr,asset_count=asset_count+da,project_count=project_count+dp
 where owner_id=uid and (du+dr<=0 or used_bytes+reserved_bytes+du+dr<=limit_bytes)
 and (da<=0 or asset_count+da<=max_assets) and (dp<=0 or project_count+dp<=max_projects) returning * into q;
 if not found then raise exception 'CLOUD_QUOTA_EXCEEDED';end if;
 if tg_table_name='media_assets' then
  if tg_op='INSERT' then
   if (select count(*) from public.media_assets where project_id=new.project_id)>100 then raise exception 'CLOUD_PROJECT_FILE_LIMIT';end if;
  end if;
 end if;
 return null;
end;$$;
create trigger cloud_asset_account after insert or update or delete on public.media_assets for each row execute function film_private.account_cloud_change();
create trigger cloud_project_account after insert or update or delete on public.projects for each row execute function film_private.account_cloud_change();

create function film_private.cloud_upload_allowed(p_bucket text,p_path text) returns boolean language plpgsql security definer set search_path='' as $$
declare a public.media_assets;
begin
 if auth.uid() is null then return false;end if;
 if p_bucket='film-originals' then select * into a from public.media_assets where original_path=p_path and owner_id=auth.uid() for share;
 elsif p_bucket='film-thumbnails' then select * into a from public.media_assets where thumbnail_path=p_path and owner_id=auth.uid() for share;
 else return false;end if;
 return found and a.status='pending' and a.cloud_charge_bytes=54525952;
end;$$;
-- Restrictive policies intersect the existing owner policies, including other permissive policies.
create policy film_quota_upload on storage.objects as restrictive for insert to authenticated with check (bucket_id not in('film-originals','film-thumbnails') or film_private.cloud_upload_allowed(bucket_id,name));
create policy film_quota_update on storage.objects as restrictive for update to authenticated using (bucket_id not in('film-originals','film-thumbnails') or film_private.cloud_upload_allowed(bucket_id,name)) with check (bucket_id not in('film-originals','film-thumbnails') or film_private.cloud_upload_allowed(bucket_id,name));

create function film_private.read_cloud_quota() returns jsonb language plpgsql security definer set search_path='' as $$
declare q film_private.cloud_quotas;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED';end if;
 select * into q from film_private.cloud_quotas where owner_id=auth.uid();
 return jsonb_build_object('limit_bytes',coalesce(q.limit_bytes,1073741824),'used_bytes',coalesce(q.used_bytes,0),'reserved_bytes',coalesce(q.reserved_bytes,0),'asset_count',coalesce(q.asset_count,0),'max_assets',coalesce(q.max_assets,1000),'project_count',coalesce(q.project_count,0),'max_projects',coalesce(q.max_projects,100),'upload_reservation_bytes',54525952);
end;$$;
create function public.get_cloud_quota() returns jsonb language sql security invoker set search_path='' as $$select film_private.read_cloud_quota();$$;
revoke all on function film_private.prepare_cloud_asset(),film_private.account_cloud_change(),film_private.cloud_upload_allowed(text,text),film_private.read_cloud_quota(),public.get_cloud_quota() from public,anon,authenticated;
grant execute on function film_private.cloud_upload_allowed(text,text),film_private.read_cloud_quota(),public.get_cloud_quota() to authenticated;
-- RLS does not protect TRUNCATE. Remove excess default privileges from client roles.
revoke truncate,trigger,references on public.profiles,public.projects,public.media_assets,public.edits,public.recipes,public.favorites,public.editing_history from anon,authenticated;
commit;
