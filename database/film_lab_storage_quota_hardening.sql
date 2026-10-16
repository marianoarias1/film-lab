begin;
create policy backend_only on film_private.cloud_quotas for all to authenticated using (false) with check (false);
create or replace function film_private.account_cloud_change() returns trigger language plpgsql security definer set search_path='' as $$
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
 -- auth.users cascades may remove the quota row before child assets/projects.
 if tg_op='DELETE' and not exists(select 1 from auth.users where id=uid) then return null;end if;
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
commit;
