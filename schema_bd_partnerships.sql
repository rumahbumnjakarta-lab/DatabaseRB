-- ==============================================================================
-- RUMAH BUMN JAKARTA — DATABASE SCHEMA
-- Divisi: Business Development
-- Table: bd_partnerships
-- Deskripsi: Melacak outreach, prospek, dan kerjasama dengan komunitas
-- ==============================================================================

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

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.bd_partnerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users"
  ON public.bd_partnerships FOR SELECT TO authenticated USING (true);

CREATE POLICY "Enable insert for authenticated users"
  ON public.bd_partnerships FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users"
  ON public.bd_partnerships FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Enable delete for authenticated users"
  ON public.bd_partnerships FOR DELETE TO authenticated USING (true);
