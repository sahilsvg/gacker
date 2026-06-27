CREATE TABLE public.goon_tracker (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  gooned BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.goon_tracker ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read goon_tracker" ON public.goon_tracker FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert goon_tracker" ON public.goon_tracker FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update goon_tracker" ON public.goon_tracker FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.goon_tracker;

CREATE TABLE public.email_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  subscribed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read email_subscribers" ON public.email_subscribers FOR SELECT USING (true);
CREATE POLICY "Anyone can insert email_subscribers" ON public.email_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update email_subscribers" ON public.email_subscribers FOR UPDATE USING (true);