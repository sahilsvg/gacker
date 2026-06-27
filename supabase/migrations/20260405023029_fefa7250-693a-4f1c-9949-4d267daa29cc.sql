DROP POLICY IF EXISTS "Allow authenticated insert" ON public.goon_tracker;
DROP POLICY IF EXISTS "Allow authenticated update" ON public.goon_tracker;
CREATE POLICY "Allow public insert" ON public.goon_tracker FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update" ON public.goon_tracker FOR UPDATE USING (true) WITH CHECK (true);