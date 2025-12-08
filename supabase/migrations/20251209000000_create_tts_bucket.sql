-- Create tts bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('tts', 'tts', true)
on conflict (id) do nothing;

-- Set up access policies for the tts bucket
create policy "Public Access"
  on storage.objects for select
  using ( bucket_id = 'tts' );

create policy "Authenticated users can upload"
  on storage.objects for insert
  with check ( bucket_id = 'tts' and auth.role() = 'authenticated' );

create policy "Authenticated users can update"
  on storage.objects for update
  using ( bucket_id = 'tts' and auth.role() = 'authenticated' );

create policy "Authenticated users can delete"
  on storage.objects for delete
  using ( bucket_id = 'tts' and auth.role() = 'authenticated' );
