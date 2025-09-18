insert into storage.buckets (id, name, public) values ('tts','tts', true) on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='tts_read') then
    execute 'drop policy tts_read on storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='tts_insert') then
    execute 'drop policy tts_insert on storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='tts_update') then
    execute 'drop policy tts_update on storage.objects';
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='tts_delete') then
    execute 'drop policy tts_delete on storage.objects';
  end if;
end$$;

create policy tts_read on storage.objects for select using (bucket_id = 'tts');
create policy tts_insert on storage.objects for insert with check (bucket_id = 'tts');
create policy tts_update on storage.objects for update using (bucket_id = 'tts');
create policy tts_delete on storage.objects for delete using (bucket_id = 'tts');
