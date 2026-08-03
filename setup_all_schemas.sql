-- ==============================================================================
-- RUMAH BUMN JAKARTA — COMBINED DATABASE SCHEMAS
-- Salin seluruh isi query ini dan paste di Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Tambah Kolom Divisi di Tabel Users (Untuk Rekap Absen)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS divisi text;

-- 2. Schema Business Development (Tabel bd_partnerships)
CREATE TABLE IF NOT EXISTS public.bd_partnerships (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Info Outreach & Kerja Sama
  tanggal_dihubungi date NOT NULL,
  tanggal_kerjasama date,
  
  -- Info Komunitas
  nama_komunitas text NOT NULL,
  linkedin text,
  instagram text,
  email text,
  kontak_komunitas text,
  nama_cp text,
  kontak_cp text,
  jumlah_anggota text,
  
  -- Status & Tracking
  status text NOT NULL DEFAULT 'Approach',
  via text,
  template_approach text,
  
  -- Relasi
  created_by uuid REFERENCES public.users(id)
);

ALTER TABLE public.bd_partnerships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable read access for all authenticated users"
  ON public.bd_partnerships FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable insert for authenticated users"
  ON public.bd_partnerships FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable update for authenticated users"
  ON public.bd_partnerships FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.bd_partnerships;
CREATE POLICY "Enable delete for authenticated users"
  ON public.bd_partnerships FOR DELETE TO authenticated USING (true);

-- 3. Schema Sosmed Content Planner (Tabel content_plans)
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

DROP POLICY IF EXISTS "content_plans_select" ON public.content_plans;
CREATE POLICY "content_plans_select" ON public.content_plans FOR SELECT USING (true);

DROP POLICY IF EXISTS "content_plans_insert" ON public.content_plans;
CREATE POLICY "content_plans_insert" ON public.content_plans FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "content_plans_update" ON public.content_plans;
CREATE POLICY "content_plans_update" ON public.content_plans FOR UPDATE USING (true);

DROP POLICY IF EXISTS "content_plans_delete" ON public.content_plans;
CREATE POLICY "content_plans_delete" ON public.content_plans FOR DELETE USING (true);

-- 4. Schema Design Requests (Tabel design_requests)
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

DROP POLICY IF EXISTS "design_requests_select" ON public.design_requests;
CREATE POLICY "design_requests_select" ON public.design_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "design_requests_insert" ON public.design_requests;
CREATE POLICY "design_requests_insert" ON public.design_requests FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "design_requests_update" ON public.design_requests;
CREATE POLICY "design_requests_update" ON public.design_requests FOR UPDATE USING (true);

DROP POLICY IF EXISTS "design_requests_delete" ON public.design_requests;
CREATE POLICY "design_requests_delete" ON public.design_requests FOR DELETE USING (true);
