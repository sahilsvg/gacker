-- Add image URL column to entries
ALTER TABLE entries ADD COLUMN IF NOT EXISTS image_url text;

-- Create post-images storage bucket (public, 10 MB limit, images only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-images',
  'post-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own folder
CREATE POLICY "post_images_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: anyone can read (URLs are public)
CREATE POLICY "post_images_select"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'post-images');

-- RLS: users can overwrite / update their own files
CREATE POLICY "post_images_update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: users can delete their own files
CREATE POLICY "post_images_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'post-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
