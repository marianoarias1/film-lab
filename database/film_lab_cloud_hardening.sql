create index edits_asset_owner_idx on public.edits(asset_id,owner_id);
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke update on public.editing_history from authenticated;
