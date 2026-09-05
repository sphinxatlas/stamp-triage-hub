CREATE POLICY "captures_crops_all" ON storage.objects FOR ALL TO anon, authenticated
USING (bucket_id IN ('captures','crops')) WITH CHECK (bucket_id IN ('captures','crops'));