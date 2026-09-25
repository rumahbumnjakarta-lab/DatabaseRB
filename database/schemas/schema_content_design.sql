-- =============================================
-- Schema: Content Planner & Design Request
-- Jalankan di Supabase SQL Editor
-- =============================================

-- 1. Tabel Content Plans (Sosmed Content Planner)
CREATE TABLE IF NOT EXISTS public.content_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT NOT NULL,
  content_type TEXT,
  publish_date DATE NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.content_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_plans_select" ON public.content_plans FOR SELECT USING (true);
CREATE POLICY "content_plans_insert" ON public.content_plans FOR INSERT WITH CHECK (true);
CREATE POLICY "content_plans_update" ON public.content_plans FOR UPDATE USING (true);
CREATE POLICY "content_plans_delete" ON public.content_plans FOR DELETE USING (true);


-- 2. Tabel Design Requests
CREATE TABLE IF NOT EXISTS public.design_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_name TEXT NOT NULL,
  requester_division TEXT NOT NULL,
  design_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  deadline DATE,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  designer_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "design_requests_select" ON public.design_requests FOR SELECT USING (true);
CREATE POLICY "design_requests_insert" ON public.design_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "design_requests_update" ON public.design_requests FOR UPDATE USING (true);
CREATE POLICY "design_requests_delete" ON public.design_requests FOR DELETE USING (true);
