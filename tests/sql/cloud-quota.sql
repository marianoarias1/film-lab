-- Run in an isolated transaction after the migration; always rolls back test identities/data.
begin;
create temp table quota_test_ids as select gen_random_uuid() as uid,gen_random_uuid() as outsider,gen_random_uuid() as project_id,gen_random_uuid() as asset_id;
grant select on quota_test_ids to authenticated;
insert into auth.users(id,email) select uid,uid::text||'@quota-test.invalid' from quota_test_ids union all select outsider,outsider::text||'@quota-test.invalid' from quota_test_ids;
select set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true) from quota_test_ids;
set local role authenticated;
insert into public.projects(id,owner_id,name) select project_id,uid,'Quota verification' from quota_test_ids;
reset role;
update film_private.cloud_quotas set limit_bytes=62914560 where owner_id=(select uid from quota_test_ids);
set local role authenticated;
insert into public.media_assets(id,project_id,owner_id,filename,kind,mime_type,size_bytes,original_path)
select asset_id,project_id,uid,'test.jpg','photo','image/jpeg',1,uid||'/'||project_id||'/'||asset_id||'/original.jpg' from quota_test_ids;
-- Repeated upsert must not double-charge. Client-supplied charge is ignored.
insert into public.media_assets(id,project_id,owner_id,filename,kind,mime_type,size_bytes,original_path,cloud_charge_bytes)
select asset_id,project_id,uid,'test.jpg','photo','image/jpeg',1,uid||'/'||project_id||'/'||asset_id||'/original.jpg',0 from quota_test_ids
on conflict(id) do update set status='pending',cloud_charge_bytes=0;
do $$declare q jsonb; begin
 q:=public.get_cloud_quota();
 if (q->>'reserved_bytes')::bigint<>54525952 or (q->>'asset_count')::int<>1 then raise exception 'ASSERT_RESERVATION';end if;
 if not film_private.cloud_upload_allowed('film-originals',(select uid||'/'||project_id||'/'||asset_id||'/original.jpg' from quota_test_ids)) then raise exception 'ASSERT_UPLOAD_PERMISSION';end if;
 if film_private.cloud_upload_allowed('film-originals','unregistered.jpg') then raise exception 'ASSERT_UNREGISTERED_UPLOAD';end if;
 begin
  insert into public.media_assets(id,project_id,owner_id,filename,kind,mime_type,size_bytes,original_path)
  select id,project_id,uid,'second.jpg','photo','image/jpeg',1,uid||'/'||project_id||'/'||id||'/original.jpg' from quota_test_ids cross join lateral(select gen_random_uuid() id) n;
  raise exception 'ASSERT_LIMIT_NOT_ENFORCED';
 exception when others then if sqlerrm<>'CLOUD_QUOTA_EXCEEDED' then raise;end if;end;
 begin update public.media_assets set status='ready' where id=(select asset_id from quota_test_ids);raise exception 'ASSERT_FAKE_COMPLETION';exception when others then if sqlerrm<>'UPLOAD_PENDING' then raise;end if;end;
 begin update public.media_assets set size_bytes=2 where id=(select asset_id from quota_test_ids);raise exception 'ASSERT_RESIZE';exception when others then if sqlerrm<>'CLOUD_ASSET_IMMUTABLE' then raise;end if;end;
 begin update film_private.cloud_quotas set limit_bytes=999999999999;raise exception 'ASSERT_QUOTA_EDITABLE';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','public.media_assets','TRUNCATE') then raise exception 'ASSERT_TRUNCATE';end if;
 delete from public.media_assets where id=(select asset_id from quota_test_ids);
 q:=public.get_cloud_quota();if (q->>'reserved_bytes')::bigint<>0 or (q->>'asset_count')::int<>0 then raise exception 'ASSERT_RELEASE';end if;
 if film_private.cloud_upload_allowed('film-originals',(select uid||'/'||project_id||'/'||asset_id||'/original.jpg' from quota_test_ids)) then raise exception 'ASSERT_DELETED_UPLOAD';end if;
 delete from public.projects where id=(select project_id from quota_test_ids);
 if (public.get_cloud_quota()->>'project_count')::int<>0 then raise exception 'ASSERT_PROJECT_RELEASE';end if;
end;$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true) from quota_test_ids;
set local role authenticated;
do $$begin if (public.get_cloud_quota()->>'used_bytes')::bigint<>0 then raise exception 'ASSERT_ACCOUNT_ISOLATION';end if;end;$$;
reset role;
select 'PASS quota: reservation, repeated upsert, understated size, excess upload, fake completion, immutable identity, protected limits, no truncate, release, account isolation' as result;
rollback;
