-- Storage RLS Policies for recordings bucket
-- Execute in Supabase SQL Editor after creating 'recordings' bucket (Private)

-- 读：本人可读 recordings 桶中以 uid/ 为前缀的对象
create policy if not exists "recordings_select_own"
on storage.objects for select
to authenticated
using (
  bucket_id = 'recordings'
  and (split_part(name, '/', 1))::uuid = auth.uid()
);

-- 写：本人可在自己前缀下插入对象
create policy if not exists "recordings_insert_own"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'recordings'
  and (split_part(name, '/', 1))::uuid = auth.uid()
);

-- 更新：仅本人可更新自有对象
create policy if not exists "recordings_update_own"
on storage.objects for update
to authenticated
using (
  bucket_id = 'recordings'
  and (split_part(name, '/', 1))::uuid = auth.uid()
)
with check (
  bucket_id = 'recordings'
  and (split_part(name, '/', 1))::uuid = auth.uid()
);

-- 删：仅本人可删除自有对象
create policy if not exists "recordings_delete_own"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'recordings'
  and (split_part(name, '/', 1))::uuid = auth.uid()
);
