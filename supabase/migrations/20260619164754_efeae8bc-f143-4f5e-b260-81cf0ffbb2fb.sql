
-- Revoke EXECUTE on internal SECURITY DEFINER functions (they only run via triggers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;

-- Storage policies: aria-uploads (private, owner-only)
CREATE POLICY "aria_uploads_select_own" ON storage.objects FOR SELECT
  USING (bucket_id = 'aria-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "aria_uploads_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'aria-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "aria_uploads_update_own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'aria-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "aria_uploads_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'aria-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies: aria-images (private, owner-only)
CREATE POLICY "aria_images_select_own" ON storage.objects FOR SELECT
  USING (bucket_id = 'aria-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "aria_images_insert_own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'aria-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "aria_images_update_own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'aria-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "aria_images_delete_own" ON storage.objects FOR DELETE
  USING (bucket_id = 'aria-images' AND auth.uid()::text = (storage.foldername(name))[1]);
